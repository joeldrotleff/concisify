import ffmpeg from 'fluent-ffmpeg';

function getEncoders() {
  return new Promise<string | undefined>((resolve, reject) => {
    ffmpeg.getAvailableEncoders((err, encoders) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.stringify(encoders));
      }
    });
  });
}

export async function GET(request: Request) { 
  return Response.json({ 
    encoders: await getEncoders()
  });
}