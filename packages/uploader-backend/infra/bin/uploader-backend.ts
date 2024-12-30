#!/usr/bin/env node
import { config } from 'dotenv';

config({
  path: [
    './.env.local',
    './.env.dev',
    './.env'
  ]
});

import * as cdk from 'aws-cdk-lib';
import { UploaderBackendStack } from '../lib/uploader-backend-stack';

const env = {
  account: process.env['AWS_TARGET_ACCOUNT']!,
  region: process.env['AWS_TARGET_REGION']!,
  prefix: process.env['AWS_TARGET_ENV']!
};
const maxCodeLife = process.env['SHORT_CODE_MAX_LIFE'];

if (!(env.account && env.region && env.prefix && maxCodeLife)) {
  throw new Error('Missing one or more required environment variables');
}

const app = new cdk.App();
const uploaderBackend = new UploaderBackendStack(app, `${env.prefix}UploaderBackend`, {
  env,
  maxCodeLife
});
