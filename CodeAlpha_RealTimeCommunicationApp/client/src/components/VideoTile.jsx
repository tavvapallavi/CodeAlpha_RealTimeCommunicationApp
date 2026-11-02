import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";

export default function VideoTile({ stream, name, muted = false, mirror = false, micOn = true, camOn = true, sharing = false }) {
  const ref = useRef(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
    if (!stream) return undefined;
    // Tracks can arrive after the stream does, so re-check when they change.
    const bump = () => setTick((t) => t + 1);
    stream.addEventListener("addtrack", bump);
    stream.addEventListener("removetrack", bump);
    return () => {
      stream.removeEventListener("addtrack", bump);
      stream.removeEventListener("removetrack", bump);
    };
  }, [stream]);

  const hasVideo = !!stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideo && (camOn || sharing);

  return (
    <div className="tile">
      {/* Always render the element when there is a stream, so audio keeps playing. */}
      {stream && (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={`${mirror && !sharing ? "mirror" : ""} ${showVideo ? "" : "video-hidden"}`}
        />
      )}
      {!showVideo && (
        <div className="tile-avatar">
          <Avatar name={name} />
          <span className="tile-off">{hasVideo || !stream ? "Camera off" : "Audio only"}</span>
        </div>
      )}
      <span className="tile-name">
        {name}
        {sharing ? " (sharing screen)" : ""}
        {!micOn && <span className="tile-muted"> · muted</span>}
      </span>
    </div>
  );
}
