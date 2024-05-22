import ffmpeg from 'fluent-ffmpeg';
import OpenAI from "openai";
import { Bucket } from "sst/node/bucket";
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import tmp from 'tmp'
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Config } from "sst/node/config";

const AWS_REGION = "us-east-1";

async function createTempFile(fileName: string) {
  return new Promise<string>((resolve, reject) => {
    tmp.file({ postfix: fileName }, (err: any, path: string) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

async function createTempFolder(folderName: string) {
  return new Promise<string>((resolve, reject) => {
    tmp.dir({ postfix: folderName }, (err: any, path: string) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

async function writeToFile(filePath: string, data: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filePath, data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function transcribe(audioFilePath: string) {
  const openai = new OpenAI({
    apiKey: Config.OPENAI_API_KEY
  });
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"]
  });

  // console.log("Transcription: ", transcription);

  return transcription;
}

async function convertVideoToAudio(inputFilePath: string, outputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .output(outputFilePath)
      .on('end', function() {
        console.log('conversion ended');
        resolve();
      }).on('error', function(e) {
        console.log('error: ', e.code, e.msg);
        reject(e);
      }).run();
  });
}


async function getUnnecessaryParts(transcript: string, strength: string) {
  let prompt: string;
  if (strength === 'High') {
    prompt = fs.readFileSync("claude_prompt_get_unnecessary_from_transcript_aggressive.txt", "utf8");
  } else {
    prompt = fs.readFileSync("claude_prompt_get_unnecessary_from_transcript.txt", "utf8");
  }
  prompt = prompt.replace("((REPLACE_ME_WITH_TRANSCRIPT))", transcript);
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";
  // console.log(`Prompt: ${prompt}`);
  // console.log(`Model ID: ${modelId}`);

  try {
    // console.log("-".repeat(53));
    const response = await invokeModel(prompt, modelId);

    // console.log("\n" + "-".repeat(53));
    // console.log("Unnecessary parts removed successfully:");
    // console.log(response);
    return response;
  } catch (err) {
    console.log(`\n${err}`);
  }
}

async function getSegmentsToKeep(bracketedTranscript: string, timestampedTranscript: string) {
  let prompt = fs.readFileSync("claude_prompt_get_stamps_to_keep.txt", "utf8");
  // console.log(' bracketedTranscript:', bracketedTranscript);
  // console.log(' timestampedTranscript:', timestampedTranscript);
  prompt = prompt.replace("((REPLACE_ME_WITH_BRACKETED))", bracketedTranscript);
  prompt = prompt.replace("((REPLACE_ME_WITH_TIMESTAMPED))", timestampedTranscript);
  const modelId = "anthropic.claude-3-sonnet-20240229-v1:0";
  const response = await invokeModel(prompt, modelId);
  // console.log(`Prompt: ${prompt}`);
  // console.log(`Model ID: ${modelId}`);

  try {
    console.log(response);
    return response;
  } catch (err) {
    console.log(`\n${err}`);
  }
}

// import ffmpeg from 'fluent-ffmpeg';

/**
 * 
 * @param {string} inputVideo 
 * @param {Array<Array<number>>} segmentsToKeep - array of arrays of timestamps to keep
 * @param {string} outputVideo - the path for the output video
 */
async function clipVideoFromSegments(inputVideoPath: string, segmentsToKeep: Array<Array<number>>, outputVideoPath: string) {
  const tempFilePaths: string[] = [];

  const createSegment = async (start: number, end: number, index: number): Promise<void> => {
    const tempFile = await createTempFile(`temp_segment_${randomUUID()}_${index}.mp4`);
    tempFilePaths.push(tempFile);
    return new Promise((resolve, reject) => {
      ffmpeg(inputVideoPath)
        .setStartTime(start)
        .setDuration(end - start)
        .output(tempFile)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  };

  const mergeSegments = async (): Promise<void> => {
    const tempFolderPath = await createTempFolder('temp_merged_segments');
    return new Promise((resolve, reject) => {
      const mergedVideo = ffmpeg();
      tempFilePaths.forEach(file => mergedVideo.input(file));
      mergedVideo
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .mergeToFile(outputVideoPath, tempFolderPath);
    });
  };

  try {
    for (let i = 0; i < segmentsToKeep.length; i++) {
      const [start, end] = segmentsToKeep[i];
      await createSegment(start, end, i);
    }
    await mergeSegments();
    console.log('Video processing complete');
  } catch (error) {
    console.error('Error processing video:', error);
  }
  tempFilePaths.forEach(file => fs.unlinkSync(file));
}


/**
 * Invokes Anthropic Claude 3 using the Messages API.
 *
 * To learn more about the Anthropic Messages API, go to:
 * https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html
 *
 * @param {string} prompt - The input text prompt for the model to complete.
 * @param {string} [modelId] - The ID of the model to use. Defaults to "anthropic.claude-3-haiku-20240307-v1:0".
 */
async function invokeModel(
  prompt: string,
  modelId = "anthropic.claude-3-sonnet-20240229-v1:0",
) {
  // Create a new Bedrock Runtime client instance.
  const client = new BedrockRuntimeClient({ region: AWS_REGION });

  // Prepare the payload for the model.
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };

  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId,
  });
  const apiResponse = await client.send(command);

  // Decode and return the response(s)
  const decodedResponseBody = new TextDecoder().decode(apiResponse.body);
  /** @type {MessagesResponseBody} */
  const responseBody = JSON.parse(decodedResponseBody);
  return responseBody.content[0].text;
}

export async function POST(request: Request) {
  const body = await request.json();

  const conscisingStrength = body.concisingStrength;
  if (!conscisingStrength) {
    console.error('concisingStrength not provided in the request body');
    return Response.error();
  }

  const client = new S3Client({ region: AWS_REGION });
  const videoName = "sample_video.mov"
  const bucketName = Bucket.UploadedVideos.bucketName
  const params = {
    Bucket: bucketName,
    Key: videoName
  }
  const command = new GetObjectCommand(params);

  console.log('getting video from s3')
  const response = await client.send(command);

  const videoFilePath = await createTempFile(videoName);
  console.log('writing video to temp file')
  await writeToFile(videoFilePath, await response.Body?.transformToByteArray() as Buffer);

  const audioFilePath = await createTempFile(randomUUID() + ".mp3");
  console.log('converting video to audio')
  await convertVideoToAudio(videoFilePath, audioFilePath);

  console.log('getting transcript');
  const transcript = await transcribe(audioFilePath);
  const transcriptText = transcript.text;
  console.log('done getting transcript');
  console.log('actual Transcript:', transcriptText);

  const unnecessaryParts = await getUnnecessaryParts(transcriptText, conscisingStrength); 
  console.log('done getting unnecessary parts: ' + unnecessaryParts);
  const transcriptAsString = JSON.stringify(transcript);
  const segmentsToKeepResponse = await getSegmentsToKeep(unnecessaryParts, transcriptAsString);
  const wantToKeepSegments = JSON.parse(segmentsToKeepResponse).result;
  console.log('done getting segments to keep: ' + wantToKeepSegments);
  const resultingVideoFileName = randomUUID() + "_output.mp4";
  const resultingVideoFilePath = await createTempFile(resultingVideoFileName);
  console.log('clipping video from segments');
  await clipVideoFromSegments(videoFilePath, wantToKeepSegments, resultingVideoFilePath);

  console.log('reading resulting video from the temp folder');
  const resultingVideo = fs.readFileSync(resultingVideoFilePath);

  console.log("Making the resulting video available for download");

  console.log('uploading resulting video to s3');
  const putParams = {
    ACL: "public-read",
    Bucket: bucketName,
    Key: resultingVideoFileName,
    Body: resultingVideo,
    ContentType: 'video/mp4'
  }
  // @ts-expect-error
  const putCommand = new PutObjectCommand(putParams);
  await client.send(putCommand);

  // return the public signed url of the video in the bucket
  return new Response(JSON.stringify({ url: `https://${bucketName}.s3.amazonaws.com/${resultingVideoFileName}` }), {
    headers: { 'Content-Type': 'application/json' }
  });

}
