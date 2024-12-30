import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { UploaderBackendStack, UploaderBackendStackProps } from "./uploader-backend-stack";

describe('uploader-backend-stack', () => {
  let props: UploaderBackendStackProps
  let template: Template;

  function setUp() {
    const app = new App();
    const stack = new UploaderBackendStack(app, 'TestStack', props);
    template = Template.fromStack(stack);
  };

  beforeEach(() => {
    props = {
      env: {
        account: '1',
        region: 'region',
        prefix: 'tst'
      },
      bucket: 'bucket',
      maxCodeLife: '86400'
    };
    setUp();
  });

  test('should create a dynamo table for tracking short codes and no S3 bucket', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: Match.stringLikeRegexp('^tst-')
    });
    const thing = template.findResources('AWS::S3::Bucket');
    expect(template.findResources('AWS::S3::Bucket')).toEqual({});
  });

  test('should create an S3 bucket if a bucket name is not provided', () => {
    delete props.bucket;
    setUp();

    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: Match.stringLikeRegexp('^tst-')
    });
  });

  test('should create an api and associated lambda handlers & authorizers', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'tst-uploader-api-lambda-handler-role',
      Policies: [{
        PolicyDocument: {
          Statement: [{
            Action: Match.arrayWith([
              'logs:PutLogEvents'
            ])
          }]
        }
      }, {
        PolicyDocument: {
          Statement: [{
            Action: Match.arrayWith([
              'secretsmanager:GetSecretValue'
            ])
          }, {
            Action: [
              's3:ListBucket',
              's3:PutObject',
              'dynamodb:GetItem'
            ]
          }]
        }
      }]
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'tst-uploader-api-lambda-authorizer-role',
      Policies: [{
        PolicyDocument: {
          Statement: [{
            Action: Match.arrayWith([
              'logs:PutLogEvents'
            ])
          }]
        }
      }, {
        PolicyDocument: {
          Statement: [{
            Action: [
              'dynamodb:GetItem',
              'dynamodb:PutItem'
            ]
          }]
        }
      }]
    })
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tst-uploader-api-handler'
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tst-uploader-api-authorizer'
    });
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {});
  });
});
