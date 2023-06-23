import { AnyFetchType } from "./generic-fetch.js";

export function makeAclContent(
  serverDomainName: string,
  account: string,
  authFetch: AnyFetchType,
  targetFilename: string,
  publicRead: boolean = true,
  publicWrite: boolean = false,
  publicControl: boolean = false,
  isDir: boolean = false
) {
  const webID = `https://${serverDomainName}/${account}/profile/card#me`;

  let inherit = "";
  if (isDir) {
    targetFilename = "";
    inherit = "acl:default <./>;";
  }

  return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

${
  publicRead
    ? `<#public>
  a acl:Authorization;
  acl:accessTo <./${targetFilename}>;
  acl:agentClass foaf:Agent;
  acl:mode acl:Read${publicWrite ? ", acl:Write" : ""}${
        publicControl ? ", acl:Control" : ""
      }.`
    : ""
}
<#owner>
    a acl:Authorization;
    acl:accessTo <./${targetFilename}>;
    acl:agent <${webID}>;
    ${inherit}
    acl:mode acl:Read, acl:Write, acl:Control.
  `;
}
