#!/usr/bin/env node
import 'source-map-support/register'
import { execSync } from 'child_process'
import { App, Aspects } from '@aws-cdk/core'
import { StackTags } from '@ndlib/ndlib-cdk'
import ClassesApiStack from '../lib/classes-api-stack'
import ClassesApiPipelineStack from '../lib/classes-api-pipeline-stack'

// The context values here are defaults only. Passing context in cli will override these
const username = execSync('id -un').toString().trim()
const app = new App({
  context: {
    owner: username,
    contact: `${username}@nd.edu`,
  },
})
Aspects.of(app).add(new StackTags())

const stage = app.node.tryGetContext('stage') || 'dev'
const sentryProject = app.node.tryGetContext('sentryProject')

let lambdaCodePath = app.node.tryGetContext('lambdaCodePath')
let sentryVersion = app.node.tryGetContext('sentryVersion')
if (!lambdaCodePath) {
  lambdaCodePath = '../classes_api/src'
  sentryVersion = execSync(`cd ${lambdaCodePath} && git rev-parse HEAD`).toString().trim()
}

if (lambdaCodePath) {
  const stackName = app.node.tryGetContext('serviceStackName') || `classesAPI-${stage}`
  new ClassesApiStack(app, stackName, {
    stackName,
    stage,
    lambdaCodePath,
    sentryProject,
    sentryVersion,
  })
}

const pipelineName = app.node.tryGetContext('pipelineStackName') || `classesAPI-pipeline`
new ClassesApiPipelineStack(app, pipelineName, {
  stackName: pipelineName,
  gitOwner: app.node.tryGetContext('gitOwner'),
  gitTokenPath: app.node.tryGetContext('gitTokenPath'),
  serviceRepository: app.node.tryGetContext('serviceRepository'),
  serviceBranch: app.node.tryGetContext('serviceBranch'),
  blueprintsRepository: app.node.tryGetContext('blueprintsRepository'),
  blueprintsBranch: app.node.tryGetContext('blueprintsBranch'),
  contact: app.node.tryGetContext('contact'),
  owner: app.node.tryGetContext('owner'),
  sentryTokenPath: app.node.tryGetContext('sentryTokenPath'),
  sentryOrg: app.node.tryGetContext('sentryOrg'),
  sentryProject,
  emailReceivers: app.node.tryGetContext('emailReceivers'),
  slackNotifyStackName: app.node.tryGetContext('slackNotifyStackName'),
})
