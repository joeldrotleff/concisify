import ffmpeg from 'fluent-ffmpeg';
import { Bucket } from "sst/node/bucket";
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const AWS_REGION = "us-east-1";

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
  const client = new S3Client({ region: AWS_REGION });
  const videoName = "sample_video.mov"
  const bucketName = Bucket.UploadedVideos.bucketName
  const params = {
    Bucket: bucketName,
    Key: videoName
  }
  const command = new GetObjectCommand(params);

  const response = await client.send(command);

  console.log(response.ContentLength);

  const result = await invokeModel("The quick brown fox jumps over the lazy dog");

  console.log({ result })

  return Response.json({ 
    url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  });
}