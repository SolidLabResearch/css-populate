import { AnyFetchType } from "./generic-fetch.js";
import { ProvidedAccountInfo } from "./generate-users.js";

export function makeAcrContent(
  serverDomainName: string,
  accountInfo: ProvidedAccountInfo,
  authFetch: AnyFetchType,
  targetFilename: string,
  publicRead: boolean = true,
  publicWrite: boolean = false,
  publicControl: boolean = false,
  isDir: boolean = false
) {
  const webID = `https://${serverDomainName}/${accountInfo.podName}/profile/card#me`;

  //   return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
  // @prefix acp: <http://www.w3.org/ns/solid/acp#>.
  //
  //  []
  //   a acp:AccessControlResource ;
  //   acp:resource <./${targetFilename}> ;
  //   ${
  //     publicRead
  //       ? `
  //   acp:accessControl [
  //     a acp:AccessControl ;
  //     acp:apply [
  //       a acp:Policy ;
  //       acp:allow acl:Read ${publicWrite ? ", acl:Write" : ""} ${ publicControl ? ", acl:Control" : "" } ;
  //       acp:anyOf [
  //         a acp:Matcher ;
  //         acp:agent acp:PublicAgent ;
  //       ]
  //     ]
  //   ];`
  //       : ""
  //   }
  //   acp:accessControl [
  //     a acp:AccessControl ;
  //     acp:apply [
  //       a acp:Policy ;
  //       acp:allow acl:Read, acl:Write, acl:Control ;
  //       acp:anyOf [
  //         a acp:Matcher ;
  //         acp:agent <${webID}> ;
  //       ]
  //     ]
  //   ] .
  // `;

  const publicAccess = `
<#publicAccess>
    a acp:AccessControl;
    acp:apply [
        a acp:Policy;
        acp:allow acl:Read 
            ${publicWrite ? ", acl:Write" : ""} 
            ${publicControl ? ", acl:Control" : ""};
        acp:anyOf [
            a acp:Matcher;
            acp:agent acp:PublicAgent
        ]
    ].`;

  const root = isDir
    ? `
    a acp:AccessControlResource;
    # Set the access to the subdir storage folder
    acp:resource <./>;
    # Everything is readable by the public
    acp:accessControl <#fullOwnerAccess>, <#publicReadAccess>;
    # All resources will inherit this authorization
    acp:memberAccessControl <#fullOwnerAccess>.`
    : `
    a acp:AccessControlResource;
    acp:resource <./${targetFilename}>;
    acp:accessControl <#ownerAccess>, <#publicAccess>.`;

  return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix acp: <http://www.w3.org/ns/solid/acp#>.

<#root>
    ${root}

${publicRead ? publicAccess : ""}

<#ownerAccess>
    a acp:AccessControl;
    acp:apply [
        a acp:Policy;
        acp:allow acl:Read, acl:Write, acl:Control;
        acp:anyOf [
            a acp:Matcher;
            acp:agent <${webID}>
        ]
    ].`;
}
