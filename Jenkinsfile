pipeline {

  agent none

  options {
    buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '15', daysToKeepStr: '90', numToKeepStr: '')
  }

  environment {
    GHCR_IMAGE_BASE = 'ghcr.io/intranda/goobi-viewer-theme-reference'
    DOCKERHUB_IMAGE_BASE = 'intranda/goobi-viewer-theme-reference'
    NEXUS_IMAGE_BASE = 'nexus.intranda.com:4443/goobi-viewer-theme-reference'
  }

  stages {
    stage('build') {
      agent {
        docker {
          image 'maven:3-eclipse-temurin-21'
          args '-v $HOME/.m2:/var/maven/.m2:z -u 1000 -ti -e _JAVA_OPTIONS=-Duser.home=/var/maven -e MAVEN_CONFIG=/var/maven/.m2'
        }
      }
      steps {
        sh 'git clean -fdx'
        sh 'mvn -f goobi-viewer-theme-reference/pom.xml clean verify'
        recordIssues enabledForFailure: true, aggregatingResults: true, tools: [java(), javaDoc()]
        archiveArtifacts artifacts: '**/target/*.war', fingerprint: true, onlyIfSuccessful: true
        stash includes: '**/target/*.war', name: 'app'
      }
    }

    stage('build and and publish docker image with corresponding config') {
      agent any
      when {
        anyOf {
          tag "v*"
          branch 'develop'
          expression { return env.BRANCH_NAME =~ /_docker$/ }
        }
      }
      steps {
        // get viewer.war from build stage
        unstash 'app'

        withCredentials([
          usernamePassword(
            credentialsId: 'jenkins-github-container-registry',
            usernameVariable: 'GHCR_USER',
            passwordVariable: 'GHCR_PASS'
          ),
          usernamePassword(
            credentialsId: '0b13af35-a2fb-41f7-8ec7-01eaddcbe99d',
            usernameVariable: 'DOCKERHUB_USER',
            passwordVariable: 'DOCKERHUB_PASS'
          ),
          usernamePassword(
            credentialsId: 'jenkins-docker',
            usernameVariable: 'NEXUS_USER',
            passwordVariable: 'NEXUS_PASS'
          )
        ]) {
          sh '''
            # Login to registries
            echo "$GHCR_PASS" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
            echo "$DOCKERHUB_PASS" | docker login docker.io -u "$DOCKERHUB_USER" --password-stdin
            echo "$NEXUS_PASS" | docker login nexus.intranda.com:4443 -u "$NEXUS_USER" --password-stdin

            # Setup QEMU and Buildx
            docker buildx create --name multiarch-builder --use || docker buildx use multiarch-builder
            docker buildx inspect --bootstrap

            CONFIG_BRANCH_NAME=develop

            # Tag logic
            TAGS=""
            if [ ! -z "$TAG_NAME" ]; then
              CONFIG_BRANCH_NAME=master
              TAGS="$TAGS -t $GHCR_IMAGE_BASE:$TAG_NAME -t $DOCKERHUB_IMAGE_BASE:$TAG_NAME -t $NEXUS_IMAGE_BASE:$TAG_NAME -t $GHCR_IMAGE_BASE:latest -t $DOCKERHUB_IMAGE_BASE:latest -t $NEXUS_IMAGE_BASE:latest"
            elif [ "$GIT_BRANCH" = "origin/develop" ] || [ "$GIT_BRANCH" = "develop" ]; then
              TAGS="$TAGS -t $GHCR_IMAGE_BASE:develop -t $DOCKERHUB_IMAGE_BASE:develop -t $NEXUS_IMAGE_BASE:develop"
            elif echo "$GIT_BRANCH" | grep -q "_docker$"; then
              TAG_SUFFIX=$(echo "$GIT_BRANCH" | sed 's/_docker$//' | sed 's|/|_|g')
              TAGS="$TAGS -t $GHCR_IMAGE_BASE:$TAG_SUFFIX -t $DOCKERHUB_IMAGE_BASE:$TAG_SUFFIX -t $NEXUS_IMAGE_BASE:$TAG_SUFFIX"
            else
              echo "No matching tag, skipping build."
              exit 0
            fi

            # Build and push to all registries
            docker buildx build --build-arg build=false \
              --no-cache --build-arg CONFIG_BRANCH=$CONFIG_BRANCH_NAME \
              --platform linux/amd64,linux/arm64/v8,linux/ppc64le,linux/riscv64,linux/s390x \
              $TAGS \
              --push .
          '''
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
