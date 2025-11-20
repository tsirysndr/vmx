import { assertEquals } from "@std/assert";
import { stringify } from "@std/yaml";
import { snakeCase } from "./xorriso.ts";

Deno.test("Serialize Seed Data to YAML", () => {
  const seed = {
    metaData: {
      instanceId: "vmx-12345",
      localHostname: "vmx-test",
    },
    userData: {
      users: [
        {
          name: "testuser",
          shell: "/bin/bash",
          sudo: ["ALL=(ALL) NOPASSWD:ALL"],
          sshAuthorizedKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAr..."],
        },
      ],
      sshPwauth: false,
      packages: ["curl", "git"],
    },
  };

  const expectedMetaDataYAML = `instance_id: vmx-12345
local_hostname: vmx-test
`;

  const expectedUserDataYAML = `users:
  - name: testuser
    shell: /bin/bash
    sudo:
      - 'ALL=(ALL) NOPASSWD:ALL'
    ssh_authorized_keys:
      - ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAr...
ssh_pwauth: false
packages:
  - curl
  - git
`;

  assertEquals(stringify(snakeCase(seed.metaData)), expectedMetaDataYAML);
  assertEquals(stringify(snakeCase(seed.userData)), expectedUserDataYAML);
});
