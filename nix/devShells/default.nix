{
  perSystem =
    { pkgs, ... }:
    {
      devshells.default = {
        devshell.name = "integration";
        packages = with pkgs; [
          # node / typescript
          nodejs
          yarn

          # dev tools
          git
          jq
          curl
          which

          # docker (for environment management)
          docker
          docker-compose

          # local-tunnel debugging (just run-sdk-swift-e2e)
          #   just     — recipe runner for the e2e orchestration
          #   gh       — triggers / watches the manual GitHub Actions run
          #   ngrok    — exposes the local stack over a public tunnel
          just
          gh
          ngrok

          # nix
          nix
          nixfmt
        ];

        env = [
          {
            name = "SSL_CERT_FILE";
            value = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
          }
          {
            name = "LANG";
            value = "C.utf8";
          }
        ];
      };
    };
}
