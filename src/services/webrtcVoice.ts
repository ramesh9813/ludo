import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { WebRTCSignal } from '../types/game';

export interface VoiceChatCallbacks {
  onSpeakingChange: (isSpeaking: boolean) => void;
  onPeerConnected?: (peerId: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onError?: (err: Error) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCVoiceManager {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private unsubscribeSignals: (() => void) | null = null;

  public roomId: string = '';
  public myUid: string = '';
  public isMuted: boolean = false;
  private callbacks: VoiceChatCallbacks;

  constructor(callbacks: VoiceChatCallbacks) {
    this.callbacks = callbacks;
  }

  // Request mic permission and start audio analysis
  async initMic(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not supported in this browser');
        return false;
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.startSpeakingDetector();
      return true;
    } catch (err: unknown) {
      console.warn('Microphone permission denied or unavailable:', err);
      if (this.callbacks.onError) {
        this.callbacks.onError(err as Error);
      }
      return false;
    }
  }

  // Detect volume levels to drive the speaking glow ring
  private startSpeakingDetector() {
    if (!this.localStream) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let currentlySpeaking = false;
      let silentFrames = 0;

      const checkAudio = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Threshold for speaking detection (when not muted)
        if (average > 18 && !this.isMuted) {
          if (!currentlySpeaking) {
            currentlySpeaking = true;
            this.callbacks.onSpeakingChange(true);
          }
          silentFrames = 0;
        } else {
          silentFrames++;
          if (silentFrames > 12 && currentlySpeaking) {
            currentlySpeaking = false;
            this.callbacks.onSpeakingChange(false);
          }
        }

        this.animFrameId = requestAnimationFrame(checkAudio);
      };

      checkAudio();
    } catch (e) {
      console.warn('Audio analyzer error:', e);
    }
  }

  // Connect to room signaling
  startSignaling(roomId: string, myUid: string, allHumanUids: string[]) {
    this.roomId = roomId;
    this.myUid = myUid;

    // Listen for signals sent to me
    const signalsRef = collection(db, 'rooms', roomId, 'signals');
    const q = query(signalsRef, where('receiverId', '==', myUid));

    this.unsubscribeSignals = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as WebRTCSignal;
          await this.handleIncomingSignal(data, change.doc.id);
        }
      });
    });

    // Establish peer connections with other human players
    // Lexicographical ordering: whoever has the smaller UID creates the offer
    for (const peerUid of allHumanUids) {
      if (peerUid === myUid) continue;
      if (myUid < peerUid) {
        this.createPeerConnection(peerUid, true);
      } else {
        this.createPeerConnection(peerUid, false);
      }
    }
  }

  private createPeerConnection(peerUid: string, isInitiator: boolean): RTCPeerConnection {
    if (this.peerConnections.has(peerUid)) {
      return this.peerConnections.get(peerUid)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerUid, pc);

    // Add local mic audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote audio stream
    pc.ontrack = (event) => {
      let audioEl = this.audioElements.get(peerUid);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        this.audioElements.set(peerUid, audioEl);
      }
      if (event.streams && event.streams[0]) {
        audioEl.srcObject = event.streams[0];
      }
      if (this.callbacks.onPeerConnected) {
        this.callbacks.onPeerConnected(peerUid);
      }
    };

    // Send local ICE candidates to peer via Firestore
    pc.onicecandidate = async (event) => {
      if (event.candidate && this.roomId) {
        try {
          const signalsRef = collection(db, 'rooms', this.roomId, 'signals');
          await addDoc(signalsRef, {
            senderId: this.myUid,
            receiverId: peerUid,
            type: 'candidate',
            payload: JSON.stringify(event.candidate),
            timestamp: Date.now(),
          });
        } catch (e) {
          console.warn('Failed to send ICE candidate:', e);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (this.callbacks.onPeerDisconnected) {
          this.callbacks.onPeerDisconnected(peerUid);
        }
      }
    };

    if (isInitiator) {
      // Create and send offer
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const signalsRef = collection(db, 'rooms', this.roomId, 'signals');
          await addDoc(signalsRef, {
            senderId: this.myUid,
            receiverId: peerUid,
            type: 'offer',
            payload: JSON.stringify(offer),
            timestamp: Date.now(),
          });
        } catch (e) {
          console.warn('Error during negotiation needed:', e);
        }
      };
    }

    return pc;
  }

  private async handleIncomingSignal(signal: WebRTCSignal, docId: string) {
    const peerUid = signal.senderId;
    let pc = this.peerConnections.get(peerUid);

    if (!pc) {
      pc = this.createPeerConnection(peerUid, false);
    }

    try {
      if (signal.type === 'offer') {
        const offer = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send back answer
        const signalsRef = collection(db, 'rooms', this.roomId, 'signals');
        await addDoc(signalsRef, {
          senderId: this.myUid,
          receiverId: peerUid,
          type: 'answer',
          payload: JSON.stringify(answer),
          timestamp: Date.now(),
        });
      } else if (signal.type === 'answer') {
        const answer = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } else if (signal.type === 'candidate') {
        const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (e) {
      console.warn('Error handling incoming WebRTC signal:', e);
    }

    // Clean up processed signal document
    try {
      const signalDoc = collection(db, 'rooms', this.roomId, 'signals');
      const q = query(signalDoc, where('receiverId', '==', this.myUid));
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        if (d.id === docId) {
          await deleteDoc(d.ref);
        }
      });
    } catch {}
  }

  // Toggle microphone mute state
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.isMuted = !this.isMuted;
        audioTracks[0].enabled = !this.isMuted;
        if (this.isMuted) {
          this.callbacks.onSpeakingChange(false);
        }
      }
    }
    return this.isMuted;
  }

  // Destroy and cleanup all resources
  leave() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.unsubscribeSignals) {
      this.unsubscribeSignals();
      this.unsubscribeSignals = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.audioElements.clear();
  }
}
