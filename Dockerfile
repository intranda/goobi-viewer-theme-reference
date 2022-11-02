FROM maven:3.6-jdk-11 AS BUILD
# you can use --build-arg build=false to skip viewer.war compilation, a viewer.war file needs to be available in target/viewer.war then
ARG build=true

COPY ./ /viewer/
WORKDIR /viewer
RUN echo $build; if [ "$build" = "true" ]; then mvn -f goobi-viewer-theme-reference/pom.xml clean package; elif [ -f "/viewer/goobi-viewer-theme-reference/target/viewer.war" ]; then echo "using existing viewer.war"; else echo "not supposed to build, but no viewer.war found either"; exit 1; fi 

# Build actual application container
FROM tomcat:9-jre11-openjdk-bullseye as ASSEMBLE

ENV DB_SERVER viewer-db
ENV DB_PORT 3306
ENV DB_NAME viewer
ENV DB_USER viewer
ENV DB_PASSWORD viewer
ENV SOLR_URL http://solr:8983/solr/collection1
ENV VIEWER_DOMAIN localhost
ENV TOMCAT_SAMESITECOOKIES strict

RUN sed -i 's|main$|main contrib|' /etc/apt/sources.list
RUN apt-get update && \
	apt-get -y install git \
	  gettext-base \
	  ttf-mscorefonts-installer \
	  libopenjp2-7 && \
	apt-get -y clean && \
	rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
	rm -rf ${CATALINA_HOME}/webapps/*

RUN ["/bin/bash","-c", "mkdir -p /opt/digiverso/{config/bin,indexer,logs,viewer/{abbyy,cmdi,deleted_mets,hotfolder,media,orig_lido,orig_denkxweb,ccess,ugc,alto,cms_media,error_mets,indexed_lido,mix,pdf,tei,updated_mets,cache,config/{PDFTitlePage,watermark},fulltext,indexed_mets,oai/token,ptif,themes,wc,bin}}"]

ARG CONFIG_BRANCH=develop

RUN echo "Using ${CONFIG_BRANCH} branch of goobi-viewer-core-config..."
RUN git clone --branch=${CONFIG_BRANCH} --depth=1 https://github.com/intranda/goobi-viewer-core-config.git /goobi-viewer-core-config/ && \
	mv /goobi-viewer-core-config/goobi-viewer-core-config/src/main/resources/install/* /opt/digiverso/viewer/config/  && \
	mv /goobi-viewer-core-config/goobi-viewer-core-config/src/main/resources/docker/viewer.xml.template /usr/local/tomcat/conf/ && \
	mv /goobi-viewer-core-config/goobi-viewer-core-config/src/main/resources/docker/run.sh / && \
	mv /goobi-viewer-core-config/goobi-viewer-core-config/src/main/resources/docker/setenv.sh /usr/local/tomcat/bin/setenv.sh && \
	patch --output=/usr/local/tomcat/conf/server.xml.template /usr/local/tomcat/conf/server.xml </goobi-viewer-core-config/goobi-viewer-core-config/src/main/resources/docker/server.xml.patch && \
	patch --output=/usr/local/tomcat/conf/context.xml.template /usr/local/tomcat/conf/context.xml </goobi-viewer-core-config/goobi-viewer-core-config/src/main/resources/docker/context.xml.patch && \
	rm -rf /goobi-viewer-core-config

RUN mkdir -p /usr/local/tomcat/conf/Catalina/localhost/ && mkdir -p /usr/local/tomcat/webapps/viewer

# redirect / to /viewer/
RUN mkdir ${CATALINA_HOME}/webapps/ROOT && \
    echo '<% response.sendRedirect("/viewer/"); %>' > ${CATALINA_HOME}/webapps/ROOT/index.jsp

COPY --from=BUILD  /viewer/goobi-viewer-theme-reference/target/viewer.war /

RUN unzip /viewer.war -d /usr/local/tomcat/webapps/viewer && rm /viewer.war

CMD ["/run.sh"]
EXPOSE 8080
EXPOSE 8009
