{
  description = "OurBlock - A decentralized neighborhood community app built on Holochain";

  inputs = {
    holonix = {
      url = "github:holochain/holonix?ref=main";
      flake = true;
    };
    nixpkgs.follows = "holonix/nixpkgs";
    flake-parts.follows = "holonix/flake-parts";
  };

  outputs = inputs@{ flake-parts, holonix, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = builtins.attrNames inputs.holonix.devShells;

      perSystem = { config, pkgs, system, ... }:
        {
          devShells.default = pkgs.mkShell {
            inputsFrom = [ inputs.holonix.devShells.${system}.default ];

            packages = with pkgs; [
              # Node.js for UI development
              nodejs_20
              nodePackages.pnpm

              # Additional development tools
              git
              jq
              curl
              wget

              # Rust tools (supplementary to holonix)
              cargo-watch
              cargo-edit
            ];

            shellHook = ''
              echo ""
              echo "🏘️  Welcome to OurBlock Development Environment"
              echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
              echo ""
              echo "Holochain tools available:"
              echo "  hc        - Holochain CLI"
              echo "  holochain - Holochain conductor"
              echo "  lair-keystore - Key management"
              echo ""
              echo "Run 'hc --version' to verify the installation."
              echo ""
            '';
          };
        };
    };
}
