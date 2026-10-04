import { useEffect, useRef, useState } from 'react';

export function readTableCode(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const table = url.searchParams.get('table');
    if (table) return table.toUpperCase();
  } catch {
    /* plain text */
  }
  const match = text.match(/\bT\d{2}\b/i);
  return match ? match[0].toUpperCase() : null;
}

export function TableScanner({ onTable }: { onTable: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open the camera. Use the table QR from the phone camera instead.');
        return;
      }
      try {
        const jsQR = (await import('jsqr')).default;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        const video = videoRef.current;
        if (stop || !video) return;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (stop) return;
          if (context && video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
            const code = found ? readTableCode(found.data) : null;
            if (code) {
              onTable(code);
              return;
            }
          }
          timer = window.setTimeout(tick, 180);
        };
        tick();
      } catch {
        if (!stop) setError('Allow camera access, then scan the QR on the table.');
      }
    })();

    return () => {
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onTable]);

  return (
    <div className="stack">
      <video ref={videoRef} className="scan-video" muted playsInline />
      {error ? <p className="field-error" role="alert">{error}</p> : <p className="fine">Point the camera at the table QR.</p>}
    </div>
  );
}
