FROM rust:1.99.0-bookworm@sha256:59037199c44290f2befcdd58dcc540164763fc296950255aaefeef096a1866b0 AS build
WORKDIR /src
COPY . .
RUN cargo build --locked --release -p notes-server

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251
RUN groupadd --gid 10001 notes && useradd --uid 10001 --gid notes --no-create-home notes \
    && mkdir /data && chown notes:notes /data
COPY --from=build /src/target/release/notes-server /usr/local/bin/notes-server
USER 10001:10001
ENV NOTES_SERVER_DATA=/data
VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/notes-server"]
CMD ["serve"]
