class Env {
  const Env._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  static const devMode = bool.fromEnvironment('DEV_MODE');
  static const devPassword = String.fromEnvironment('DEV_PASSWORD');
  static const devTraineeEmails = String.fromEnvironment('DEV_TRAINEE_EMAILS');
  static const devTraineeNames = String.fromEnvironment('DEV_TRAINEE_NAMES');
  static const devCoachEmail = String.fromEnvironment('DEV_COACH_EMAIL');
  static const devCoachName = String.fromEnvironment('DEV_COACH_NAME');
}
