const VERSIONS = ["v1.3.1", "v1.3.2"];
const currentVersion = VERSIONS[VERSIONS.length - 1];

function createSvg(version, isLatestVersion) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="24"><rect width="100" height="24" fill="#000"></rect><text font-family="system-ui" x="30" y="15" font-size="10" fill="white">Version: ${version}</text><text x="10" y="15" font-size="10" fill="white">${isLatestVersion ? "✅" : "⚠️"}</text></svg>`;
}

export function onRequest(context) {
  console.log(context.params)
  const givenVersion = context.params.version.replace(".svg", "");
  const { searchParams } = new URL(context.request.url)
  let isLatestVersion = givenVersion === currentVersion;
  if (VERSIONS.indexOf(givenVersion) === -1) {
    // for now, assume an unknown version is up to date since we'll release very frequently
    isLatestVersion = true;
  }
  console.log("org", searchParams.get("org"))
  const response = new Response(createSvg(givenVersion, isLatestVersion))
  response.headers.set("Content-Type", "image/svg+xml");
  return response;
}