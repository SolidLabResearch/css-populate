import { AnyFetchType } from "./generic-fetch.js";

export function makeAcrContent(
  serverDomainName: string,
  account: string,
  authFetch: AnyFetchType,
  targetFilename: string,
  publicRead: boolean = true,
  publicWrite: boolean = false,
  publicControl: boolean = false
) {
  const webID = `https://${serverDomainName}/${account}/profile/card#me`;

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

  return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix acp: <http://www.w3.org/ns/solid/acp#>.

<#root>
    a acp:AccessControlResource;
    acp:resource <./${targetFilename}>;
    acp:accessControl <#ownerAccess>, <#publicAccess>.

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
