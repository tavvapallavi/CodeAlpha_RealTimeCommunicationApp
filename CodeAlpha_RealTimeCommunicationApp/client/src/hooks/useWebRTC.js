import { useCallback, useEffect, useRef, useState } from "react";

const ICE = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

// Handles camera and mic, one RTCPeerConnection per other person (a mesh),
// screen sharing, and the signalling messages that connect them.
export default function useWebRTC(socket, code) {
  const [localStream, setLocalStream] = useState(null); // what the local tile shows
  const [peers, setPeers] = useState({}); // id -> { username, stream, mic, cam }
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const pcs = useRef({});
  const pending = useRef({});
  const camStream = useRef(null);
  const screenTrack = useRef(null);
  const state = useRef({ mic: true, cam: true });

  const updatePeer = useCallback((id, patch) => {
    setPeers((p) => ({ ...p, [id]: { mic: true, cam: true, stream: null, ...p[id], ...patch } }));
  }, []);

  const removePeer = useCallback((id) => {
    pcs.current[id]?.close();
    delete pcs.current[id];
    delete pending.current[id];
    setPeers((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    let cancelled = false;

    const broadcastState = () => socket.emit("media", { ...state.current });

    const createPeer = (id, initiator) => {
      const pc = new RTCPeerConnection(ICE);
      pcs.current[id] = pc;

      const stream = camStream.current;
      const have = { audio: false, video: false };
      stream?.getTracks().forEach((t) => {
        pc.addTrack(t, stream);
        have[t.kind] = true;
      });
      // If we have no camera or mic, still ask to receive the other person's.
      if (initiator) {
        ["audio", "video"].forEach((k) => {
          if (!have[k]) pc.addTransceiver(k, { direction: "recvonly" });
        });
      }
      // Someone joining while we share our screen should see the screen.
      if (screenTrack.current) {
        pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(screenTrack.current);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("signal", { to: id, data: { candidate: e.candidate } });
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) updatePeer(id, { stream: e.streams[0] });
      };
      return pc;
    };

    const flushCandidates = async (id) => {
      const pc = pcs.current[id];
      const list = pending.current[id] || [];
      pending.current[id] = [];
      for (const c of list) await pc.addIceCandidate(c).catch(() => {});
    };

    const onSignal = async ({ from, data }) => {
      try {
        let pc = pcs.current[from];
        if (data.sdp) {
          if (data.sdp.type === "offer") {
            pc = pc || createPeer(from, false);
            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("signal", { to: from, data: { sdp: pc.localDescription } });
          } else if (pc) {
            await pc.setRemoteDescription(data.sdp);
            await flushCandidates(from);
          }
        } else if (data.candidate) {
          if (pc && pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
          else (pending.current[from] = pending.current[from] || []).push(data.candidate);
        }
      } catch (err) {
        console.error("Signalling error", err);
      }
    };

    const onPeerJoined = ({ id, username }) => {
      updatePeer(id, { username });
      broadcastState(); // let the new person know if our mic or camera is off
    };
    const onPeerLeft = (id) => removePeer(id);
    const onMedia = ({ from, payload }) => updatePeer(from, { mic: payload.mic, cam: payload.cam });

    socket.on("signal", onSignal);
    socket.on("peer-joined", onPeerJoined);
    socket.on("peer-left", onPeerLeft);
    socket.on("media", onMedia);

    (async () => {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setNotice("Camera not available. You joined with audio only.");
        } catch {
          setNotice("No camera or microphone access. You can still chat, share files and draw.");
        }
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      camStream.current = stream;
      setLocalStream(stream);
      state.current = {
        mic: !!stream?.getAudioTracks().length,
        cam: !!stream?.getVideoTracks().length,
      };
      setMicOn(state.current.mic);
      setCamOn(state.current.cam);

      socket.emit("join", { code }, async (res) => {
        if (cancelled) return;
        if (res?.error) {
          setError(res.error);
          return;
        }
        for (const p of res.peers) {
          updatePeer(p.id, { username: p.username });
          const pc = createPeer(p.id, true);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("signal", { to: p.id, data: { sdp: pc.localDescription } });
          } catch (err) {
            console.error("Offer failed", err);
          }
        }
        setJoined(true);
        broadcastState();
      });
    })();

    return () => {
      cancelled = true;
      socket.emit("leave");
      socket.off("signal", onSignal);
      socket.off("peer-joined", onPeerJoined);
      socket.off("peer-left", onPeerLeft);
      socket.off("media", onMedia);
      Object.values(pcs.current).forEach((pc) => pc.close());
      pcs.current = {};
      pending.current = {};
      camStream.current?.getTracks().forEach((t) => t.stop());
      screenTrack.current?.stop();
      camStream.current = null;
      screenTrack.current = null;
      setPeers({});
      setJoined(false);
      setSharing(false);
    };
  }, [socket, code, updatePeer, removePeer]);

  const toggleMic = () => {
    const tracks = camStream.current?.getAudioTracks() || [];
    if (!tracks.length) return;
    const next = !micOn;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
    state.current.mic = next;
    socket?.emit("media", { ...state.current });
  };

  const toggleCam = () => {
    const tracks = camStream.current?.getVideoTracks() || [];
    if (!tracks.length) return;
    const next = !camOn;
    tracks.forEach((t) => (t.enabled = next));
    setCamOn(next);
    state.current.cam = next;
    socket?.emit("media", { ...state.current });
  };

  const replaceVideoTrack = (track) => {
    Object.values(pcs.current).forEach((pc) => {
      pc.getTransceivers()
        .find((t) => t.receiver.track.kind === "video")
        ?.sender.replaceTrack(track);
    });
  };

  const stopShare = useCallback(() => {
    if (!screenTrack.current) return;
    screenTrack.current.stop();
    screenTrack.current = null;
    replaceVideoTrack(camStream.current?.getVideoTracks()[0] || null);
    setLocalStream(camStream.current);
    setSharing(false);
  }, []);

  const startShare = async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenTrack.current = track;
      track.onended = stopShare; // the browser's own "Stop sharing" button
      replaceVideoTrack(track);
      setLocalStream(new MediaStream([track]));
      setSharing(true);
    } catch {
      // The person cancelled the picker. Nothing to do.
    }
  };

  return {
    localStream,
    peers,
    joined,
    error,
    notice,
    micOn,
    camOn,
    sharing,
    toggleMic,
    toggleCam,
    toggleShare: () => (sharing ? stopShare() : startShare()),
  };
}
