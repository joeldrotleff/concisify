import ffmpeg from 'fluent-ffmpeg';

export async function GET(request: Request) { 
  // get ffmpeg available encoders
  let result: string | undefined;

  ffmpeg.getAvailableEncoders((err, encoders) => {
    if (err) {
      console.error(err);
    } else {
      console.log({ encoders })
      result = JSON.stringify(encoders)
    }
  });

  return Response.json({ 
    encoders: result
  });
}