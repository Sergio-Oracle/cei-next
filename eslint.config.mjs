import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Deux familles volontairement en AVERTISSEMENT (13/11/2026), pas en erreur :
    //  - no-explicit-any : les réponses JSON de l'API sont typées librement à la frontière (lib/api.ts, `T = any`) ; les ~400 restants
    //    se résorbent page par page, en commençant par l'examen et la surveillance. Ne pas les convertir en masse : régression à coup sûr.
    //  - set-state-in-effect : conseil de performance du compilateur React (chargement au montage), pas un défaut de fonctionnement.
    // Les avertissements restent visibles (`npx eslint .`) ; seuls les VRAIS défauts bloquent.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
