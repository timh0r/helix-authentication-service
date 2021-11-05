FROM centos:7
#
# $ docker-compose -f test/packages/docker-compose.yml up --build -d centos_7_test
# $ docker exec centos_7_test /packages/centos7_pkg_exec.sh
# $ docker stop centos_7_test
#

# The docker base images are generally minimal, and our package and its
# post-install script have certain requirements, so install those now.
RUN yum -q -y install sudo

WORKDIR /packages

# copy the package tarball and test script
COPY test/packages/centos7_pkg_exec.sh .
COPY helix-auth-svc-centos7.tgz .

# Start the init daemon (systemd) so that systemctl commands will run properly,
# and thus our package installation will be successful.
ENTRYPOINT [ "/sbin/init" ]
