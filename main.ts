import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { ArchiveProvider } from "@cdktf/provider-archive/lib/provider";
import { PubsubTopic } from "@cdktf/provider-google/lib/pubsub-topic";
import { StorageBucket } from "@cdktf/provider-google/lib/storage-bucket";
import { StorageBucketObject } from "@cdktf/provider-google/lib/storage-bucket-object";
import { DataArchiveFile } from "@cdktf/provider-archive/lib/data-archive-file";
import { resolve } from "path";
import { Cloudfunctions2Function } from "@cdktf/provider-google/lib/cloudfunctions2-function";
import { CloudRunServiceIamMember } from "@cdktf/provider-google/lib/cloud-run-service-iam-member";
import { PubsubSubscription } from "@cdktf/provider-google/lib/pubsub-subscription";
import { PubsubTopicIamBinding } from "@cdktf/provider-google/lib/pubsub-topic-iam-binding";
import { PubsubSubscriptionIamMember } from "@cdktf/provider-google/lib/pubsub-subscription-iam-member";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new GoogleProvider(this, "gcp", {
      region: "us-east1",
      project: "master-balm-420315",
    })

    new ArchiveProvider(this, "archive")

    const storageBucket = new StorageBucket(this, "StorageBucket", {
      name: "topic-functions2-example",
      location: "us-east1",
      uniformBucketLevelAccess: true,
      forceDestroy: true
    })

    // topic / dead-letter queue
    const topic = new PubsubTopic(this, "Topic", {
      name: "topic-example",

    })
    const dlq = new PubsubTopic(this, "Dlq", {
      name: "dead-letter-queue-example"
    })
    new PubsubTopicIamBinding(this, "DlqPublishBinding", {
      topic: dlq.name,
      role: "roles/pubsub.publisher",
      members: ["user:marciocadev@gmail.com"]
    })
    const dlqSubscription = new PubsubSubscription(this, "DlqSubscription", {
      name: "topic-dlq-subscription",
      topic: topic.id,
      deadLetterPolicy: {
        deadLetterTopic: dlq.id,
        maxDeliveryAttempts: 5
      }
    })
    new PubsubSubscriptionIamMember(this, "DlqPublisher", {
      role: "roles/pubsub.subscriber",
      subscription: dlqSubscription.name,
      member: "user:marciocadev@gmail.com"
    })
    // topic / dead-letter queue

    let buildConfigFunBase = {
      runtime: "nodejs20",
      entryPoint: "handler",
    }

    let serviceConfigFunBase = {
      minInstanceCount: 1,
      maxInstanceCount: 10,
      availableMemory: "256M",
      timeoutSeconds: 60,
      allTrafficOnLatestRevision: true,
    }

    // Producer function
    const producerFile = new DataArchiveFile(this, "ProducerDataArchiveFile", {
      outputPath: "producer.zip",
      sourceDir: resolve(__dirname, "./src/producer"),
      type: "zip"
    })
    const producerStorageBucket = new StorageBucketObject(this, "ProducerStorageBucket", {
      bucket: storageBucket.name,
      name: "producer.zip",
      source: producerFile.outputPath
    })
    const producerFunction = new Cloudfunctions2Function(this, "ProducerFunction", {
      location: "us-east1",
      name: "producer-function2",
      buildConfig: {
        ...buildConfigFunBase,
        source: {
          storageSource: {
            bucket: storageBucket.name,
            object: producerStorageBucket.name
          }
        }
      },
      serviceConfig: {
        ...serviceConfigFunBase,
        environmentVariables: {
          TOPIC_NAME: topic.name
        }
      }
    })
    new CloudRunServiceIamMember(this, "ProducerCloudRunServiceIamMember", {
      member: "allUsers",
      role: "roles/run.invoker",
      service: producerFunction.name,
      location: producerFunction.location,
    })
    // Producer function

    // Consumer 1 function
    const consumer1File = new DataArchiveFile(this, "Consumer1DataArchiveFile", {
      outputPath: "consumer1.zip",
      sourceDir: resolve(__dirname, "./src/consumer1"),
      type: "zip"
    })
    const consumer1StorageBucket = new StorageBucketObject(this, "Consumer1StorageBucket", {
      bucket: storageBucket.name,
      name: "consumer1.zip",
      source: consumer1File.outputPath
    })
    const consumer1Function = new Cloudfunctions2Function(this, "Consumer1Function", {
      location: "us-east1",
      name: "consumer1-functions1",
      buildConfig: {
        ...buildConfigFunBase,
        source: {
          storageSource: {
            bucket: storageBucket.name,
            object: consumer1StorageBucket.name
          }
        }
      },
      serviceConfig: {
        ...serviceConfigFunBase
      },
      eventTrigger: {
        triggerRegion: "us-east1",
        eventType: "google.cloud.pubsub.topic.v1.messagePublished",
        pubsubTopic: topic.id,
        retryPolicy: "RETRY_POLICY_RETRY",
      }
    })
    new CloudRunServiceIamMember(this, "Consumer1Member", {
      member: "allUsers",
      role: "roles/run.invoker",
      service: consumer1Function.name,
      location: consumer1Function.location,
    })
    // Consumer 1 function

    // Consumer 2 function
    const consumer2File = new DataArchiveFile(this, "Consumer2DataArchiveFile", {
      outputPath: "consumer2.zip",
      sourceDir: resolve(__dirname, "./src/consumer2"),
      type: "zip"
    })
    const consumer2StorageBucket = new StorageBucketObject(this, "Consumer2StorageBucket", {
      bucket: storageBucket.name,
      name: "consumer2.zip",
      source: consumer2File.outputPath
    })
    const consumer2Function = new Cloudfunctions2Function(this, "Consumer2Function", {
      location: "us-east1",
      name: "consumer2-functions1",
      buildConfig: {
        ...buildConfigFunBase,
        source: {
          storageSource: {
            bucket: storageBucket.name,
            object: consumer2StorageBucket.name
          }
        }
      },
      serviceConfig: {
        ...serviceConfigFunBase
      },
      eventTrigger: {
        triggerRegion: "us-east1",
        eventType: "google.cloud.pubsub.topic.v1.messagePublished",
        pubsubTopic: topic.id,
        retryPolicy: "RETRY_POLICY_RETRY"
      }
    })
    new CloudRunServiceIamMember(this, "Consumer2Member", {
      member: "allUsers",
      role: "roles/run.invoker",
      service: consumer2Function.name,
      location: consumer2Function.location,
    })
    // Consumer 2 function

    // Dead letter queue
    const dlqFile = new DataArchiveFile(this, "DeadLetterQueueDataArchiveFile", {
      outputPath: "dlq.zip",
      sourceDir: resolve(__dirname, "./src/dlq"),
      type: "zip"
    })
    const dlqStorageBucket = new StorageBucketObject(this, "DeadLetterQueueStorageBucket", {
      bucket: storageBucket.name,
      name: "dlq.zip",
      source: dlqFile.outputPath
    })
    const dlqFunction = new Cloudfunctions2Function(this, "DeadletterQueueFunction", {
      location: "us-east1",
      name: "dlq-functions1",
      buildConfig: {
        ...buildConfigFunBase,
        source: {
          storageSource: {
            bucket: storageBucket.name,
            object: dlqStorageBucket.name
          }
        }
      },
      serviceConfig: {
        ...serviceConfigFunBase
      },
      eventTrigger: {
        triggerRegion: "us-east1",
        eventType: "google.cloud.pubsub.topic.v1.messagePublished",
        pubsubTopic: dlq.id,
        retryPolicy: "RETRY_POLICY_RETRY"
      }
    })
    new CloudRunServiceIamMember(this, "DeadLetterQueueMember", {
      member: "allUsers",
      role: "roles/run.invoker",
      service: dlqFunction.name,
      location: dlqFunction.location,
    })
    // Dead letter queue
  }
}

const app = new App();
new MyStack(app, "cdktf-gcp-topic-functions2");
app.synth();
