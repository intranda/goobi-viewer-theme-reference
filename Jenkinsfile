pipeline {

  agent none

  options {
    buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '15', daysToKeepStr: '90', numToKeepStr: '')
  }

  stages {
    stage('prepare') {
      agent any
      steps {
        sh 'git clean -fdx'
      }
    }
    stage('build') {
      agent {
        docker {
          image 'maven:3-jdk-11'
          args '-v $HOME/.m2:/var/maven/.m2:z -u 1000 -ti -e _JAVA_OPTIONS=-Duser.home=/var/maven -e MAVEN_CONFIG=/var/maven/.m2'
        }
      }
      steps {
              sh 'mvn -f goobi-viewer-theme-reference/pom.xml clean verify'
              recordIssues enabledForFailure: true, aggregatingResults: true, tools: [java(), javaDoc()]
              archiveArtifacts artifacts: '**/target/*.war', fingerprint: true, onlyIfSuccessful: true
      }
    }

    stage('build docker image with config from master branch') {
      agent any
      when {
        tag "v*"
      }
      steps {
        script{
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage = docker.build("goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--no-cache --build-arg CONFIG_BRANCH=master .")
            dockerimage_public = docker.build("intranda/goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--build-arg CONFIG_BRANCH=master .")
          }
        }
      }
    }
    stage('build docker image with config from develop branch') {
      agent any
      when {
        not {
          anyOf { branch 'master'; tag "v*" }
        }
      }
      steps {
        script{
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage = docker.build("goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--no-cache --build-arg CONFIG_BRANCH=develop .")
            dockerimage_public = docker.build("intranda/goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--build-arg CONFIG_BRANCH=develop .")
          }
        }
      }
    }
    stage('basic tests'){
      agent any
      when {
        not {
          branch 'master'
        }
      }
      steps{
        script {
          dockerimage.inside {
            sh 'test -d /usr/local/tomcat/webapps/viewer || ( echo "/usr/local/tomcat/webapps/viewer missing or no directory"; exit 1 )'
            sh 'test -d /opt/digiverso/viewer || ( echo "/opt/digiverso/viewer missing or no directory"; exit 1 )'
            sh 'test -f /usr/local/tomcat/conf/viewer.xml.template || ( echo "/usr/local/tomcat/conf/viewer.xml.template missing"; exit 1 )'
            sh 'test -f /usr/local/tomcat/conf/server.xml.template || ( echo "/usr/local/tomcat/conf/server.xml.template missing"; exit 1 )'
            sh 'test -f /usr/local/tomcat/conf/context.xml.template || ( echo "/usr/local/tomcat/conf/context.xml.template missing"; exit 1 )'
            sh 'envsubst -V'
          }
        }
      }
    }
    stage('publish docker devel image to internal repository'){
      agent any
      steps{
        script {
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage.push("${env.BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}")
            dockerimage.push("${env.BRANCH_NAME}")
          }
        }
      }
    }
    stage('publish docker production image to internal repository'){
      agent any
      when {
        tag "v*"
      }
      steps{
        script {
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage.push("${env.TAG_NAME}-${env.BUILD_ID}")
            dockerimage.push("${env.TAG_NAME}")
            dockerimage.push("latest")
          }
        }
      }
    }
    stage('publish develop image to Docker Hub'){
      agent any
      when {
        branch 'develop'
      }
      steps{
        script{
          docker.withRegistry('','0b13af35-a2fb-41f7-8ec7-01eaddcbe99d'){
            dockerimage_public.push("${env.BRANCH_NAME}")
          }
        }
      }
    }
    stage('publish production image to Docker Hub'){
      agent any
      when {
        tag "v*"
      }
      steps{
        script{
          docker.withRegistry('','0b13af35-a2fb-41f7-8ec7-01eaddcbe99d'){
            dockerimage_public.push("${env.TAG_NAME}")
            dockerimage_public.push("latest")
          }
        }
      }
    }
  }
  post {
    changed {
      emailext(
        subject: '${DEFAULT_SUBJECT}',
        body: '${DEFAULT_CONTENT}',
        recipientProviders: [requestor(),culprits()],
        attachLog: true
      )
    }
  }
}
/* vim: set ts=2 sw=2 tw=120 et :*/
