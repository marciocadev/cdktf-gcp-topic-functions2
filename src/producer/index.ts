import { PubSub } from "@google-cloud/pubsub";
import { Request, Response } from "express";

const client = new PubSub();

export const handler = async (req: Request, res: Response) => {

  const body = JSON.parse(req.body)
  const message = body.message
  const buffMsg = Buffer.from(message)

  await client
    .topic(process.env.TOPIC_NAME!)
    .publishMessage({ data: buffMsg })

  res.send(`send ${message} to topic`)
}
