// Configuración pública y versionable. La publishable key no es secreta:
// la protección de datos y escrituras depende de las políticas RLS.
// Nunca colocar aquí service_role, secret key ni contraseñas.
window.zambranaPublicConfig = {
  USE_SUPABASE_VEHICLES: true,
  supabaseUrl: "https://citleqqcqeldnfasgyzz.supabase.co",
  supabasePublishableKey: "sb_publishable_QlH20Vac-dwAAgo393I9IA_dW-IkU7r",
  signedUrlExpiresIn: 3600,
  requestTimeoutMs: 12000
};
