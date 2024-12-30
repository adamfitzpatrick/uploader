import { Environment, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Function as LambdaFunction, Code, Runtime, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { parse } from 'yaml';
import { compile } from 'handlebars';
import { resolve } from 'path';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { ApiDefinition, EndpointType, SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { readFileSync } from 'fs';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess, Bucket, IBucket } from 'aws-cdk-lib/aws-s3';

const API_SPEC_PATH = resolve(__dirname, '../api-spec.yaml');
const LAMBDA_HANDLER_PATH = resolve(__dirname, '../../dist/api-handler');
const LAMBDA_AUTHORIZER_PATH = resolve(__dirname, '../../dist/authorizer');

export interface UploaderBackendStackProps extends StackProps {
  env: Required<Environment> & { prefix: string },
  bucket?: string
  maxCodeLife: string
}

export class UploaderBackendStack extends Stack {
  constructor(scope: Construct, id: string, props: UploaderBackendStackProps) {
    super(scope, id, props);

    const table = this.createTable(props);
    const bucket = this.getOrCreateBucket(props);
    const apiAuthorizer = this.createApiAuthorizer(props, table);
    const apiHandler = this.createApiHandler(props, table, bucket);

    const apiTemplateString = readFileSync(API_SPEC_PATH, 'utf-8');
    const apiSpec = parse(compile(apiTemplateString)({
      handler: apiHandler.functionArn,
      region: props.env.region
    }));
    const apiDefinition = ApiDefinition.fromInline(apiSpec);
    const api = new SpecRestApi(this, `${props.env.prefix}Api`, {
      apiDefinition,
      cloudWatchRole: true,
      endpointTypes: [EndpointType.REGIONAL]
    });
  }

  createTable(props: UploaderBackendStackProps) {
    return new Table(this, `${props.env.prefix}DynamoDbTable`, {
      tableName: `${props.env.prefix}-uploader-data-table`,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING
      },
      removalPolicy: RemovalPolicy.RETAIN
    });
  }

  getOrCreateBucket(props: UploaderBackendStackProps) {
    const id = `${props.env.prefix}TargetBucket`;
    if (props.bucket) {
      return Bucket.fromBucketName(this, id, props.bucket)
    } else {
      return new Bucket(this, id, {
        bucketName: `${props.env.prefix}-uploader-target-bucket`,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        removalPolicy: RemovalPolicy.RETAIN
      });
    }
  }

  createApiAuthorizer(props: UploaderBackendStackProps, table: Table) {
    const loggingPolicy = this.getLoggingPolicy();
    const workingPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem'
          ],
          resources: [table.tableArn]
        })
      ]
    });
    const role = new Role(this, `${props.env.prefix}ApiLambdaAuthorizerRole`, {
      roleName: `${props.env.prefix}-uploader-api-lambda-authorizer-role`,
      inlinePolicies: {
        loggingPolicy,
        workingPolicy
      },
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    });
    return new LambdaFunction(this, `${props.env.prefix}ApiLambdaAuthorizer`, {
      code: Code.fromAsset(LAMBDA_AUTHORIZER_PATH),
      runtime: Runtime.NODEJS_22_X,
      handler: 'authorizer/index.handler',
      functionName: `${props.env.prefix}-uploader-api-authorizer`,
      role,
      environment: {
        TABLE_NAME: table.tableName,
        MAX_CODE_LIFE: props.maxCodeLife
      }
    })
  }

  createApiHandler(props: UploaderBackendStackProps, table: Table, bucket: IBucket) {
    const loggingPolicy = this.getLoggingPolicy();
    const workingPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret'
          ],
          resources: ['*']
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            's3:ListBucket',
            's3:PutObject',
            'dynamodb:GetItem'
          ],
          resources: [table.tableArn]
        })
      ]
    });
    const role = new Role(this, `${props.env.prefix}ApiLambdaHandlerRole`, {
      roleName: `${props.env.prefix}-uploader-api-lambda-handler-role`,
      inlinePolicies: {
        loggingPolicy,
        workingPolicy
      },
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    });
    return new LambdaFunction(this, `${props.env.prefix}ApiLambdaHandler`, {
      code: Code.fromAsset(LAMBDA_HANDLER_PATH),
      runtime: Runtime.NODEJS_22_X,
      handler: 'api-handler/index',
      functionName: `${props.env.prefix}-uploader-api-handler`,
      role,
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: bucket.bucketName
      }
    });
  }

  getLoggingPolicy() {
    return new PolicyDocument({
      statements: [new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: ['*']
      })]
    });
  }
}
