"use client";

import { useEffect, useState } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";

const defultConcsisingStrength = 'Low'

export default function Form() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoObjectURL, setVideoObjectURL] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultVideoURL, setResultVideoURL] = useState<string | null>(null);

  const flags = useFlags();

  useEffect(() => {
    if (!videoFile) return;

    const objectURL = URL.createObjectURL(videoFile);
    setVideoObjectURL(objectURL);
  }, [videoFile]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const file = files[0];

    setVideoFile(file);
  }

  async function handleSubmit() {
    if (!videoFile) return;

    if (isProcessing) return;

    try {
      setIsProcessing(true);

      const result = await fetch("/videos", {
        method: "POST",
        body: JSON.stringify({
          concisingStrength:
            flags["concisingStrength"] ?? defultConcsisingStrength,
        }),
      });

      const resultJSON = await result.json();

      setResultVideoURL(resultJSON.url);
    } catch (error) {
      console.error("Error processing video:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  const isConsisingStrengthHigh = flags["concisingStrength"] === "High";

  return (
    <div>
      <h1 className="text-4xl font-bold text-center pb-6">
        Concisify
        {isConsisingStrengthHigh && "🔴"}
      </h1>
      <div className="flex gap-2">
        <div className="max-w-[420px]">
          {videoFile ? (
            videoObjectURL && (
              <video controls src={videoObjectURL} className="max-w-full" />
            )
          ) : (
            <div>
              <label htmlFor="text">Upload a video:</label>
              <input type="file" onInput={handleUpload} />
            </div>
          )}
        </div>

        <div>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            type="button"
            disabled={!videoFile || isProcessing}
            onClick={handleSubmit}
          >
            {isProcessing ? "Working on it..." : "Make me sound smarter!"}
          </button>
        </div>

        <div className="max-w-[420px]">
          {resultVideoURL ? (
            <video controls src={resultVideoURL} className="max-w-full" />
          ) : ''}
        </div>
      </div>
    </div>
  );
}
