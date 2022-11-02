pipeline {

  agent none

  options {
    buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '15', daysToKeepStr: '90', numToKeepStr: '')
  }

  stages {
    stage('build') {
      agent {
        docker {
          image 'maven:3-jdk-11'
          args '-v $HOME/.m2:/var/maven/.m2:z -u 1000 -ti -e _JAVA_OPTIONS=-Duser.home=/var/maven -e MAVEN_CONFIG=/var/maven/.m2'
        }
      }
      steps {
        sh 'git clean -fdx'
        sh 'mvn -f goobi-viewer-theme-reference/pom.xml clean verify'
        recordIssues enabledForFailure: true, aggregatingResults: true, tools: [java(), javaDoc()]
        archiveArtifacts artifacts: '**/target/*.war', fingerprint: true, onlyIfSuccessful: true
      }
    }

    stage('build, test and publish docker image with config from release tag in master branch') {
      agent any
      when {
        tag "v*"
      }
      steps {

        // build docker images
        script{
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage = docker.build("goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--no-cache --build-arg CONFIG_BRANCH=master .")
            dockerimage_public = docker.build("intranda/goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--build-arg CONFIG_BRANCH=master .")
          }
        }

        // run basic tests in docker image
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

        // publish docker image to internal repository
        script {
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage.push("${env.TAG_NAME}-${env.BUILD_ID}")
            dockerimage.push("${env.TAG_NAME}")
            dockerimage.push("latest")
          }
        }

        // publish docker image to docker hub
        script{
          docker.withRegistry('','0b13af35-a2fb-41f7-8ec7-01eaddcbe99d'){
            dockerimage_public.push("${env.TAG_NAME}")
            dockerimage_public.push("latest")
          }
        }
      }
    }

    stage('build, test and publish docker image with config from develop branch') {
      agent any
      when {
        not {
          anyOf { branch 'master'; tag "v*" }
        }
      }
      steps {

        // build docker images
        script{
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage = docker.build("goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--no-cache --build-arg CONFIG_BRANCH=develop .")
            dockerimage_public = docker.build("intranda/goobi-viewer-theme-reference:${BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}", "--build-arg CONFIG_BRANCH=develop .")
          }
        }

        // run basic tests in docker image
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

        // publish docker image to internal repository
        script {
          docker.withRegistry('https://nexus.intranda.com:4443','jenkins-docker'){
            dockerimage.push("${env.BRANCH_NAME}-${env.BUILD_ID}_${env.GIT_COMMIT}")
            dockerimage.push("${env.BRANCH_NAME}")
          }
        }

        // publish docker image from develop branch to docker hub
        script{
          if (env.BRANCH_NAME == 'develop') {
            docker.withRegistry('','0b13af35-a2fb-41f7-8ec7-01eaddcbe99d'){
              dockerimage_public.push("${env.BRANCH_NAME}")
            }
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
