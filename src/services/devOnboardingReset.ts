type Storage = {removeItem: (key: string) => Promise<void>; getItem: (key: string) => Promise<string | null>};

export async function resetOnboardingForDevelopment(storage: Storage, development: boolean): Promise<void> {
  if (!development) throw new Error('Onboarding reset is available only in development.');
  const key = 'pathfinder.onboarding.v1';
  await storage.removeItem(key);
  if (await storage.getItem(key) !== null) throw new Error('Onboarding completion is still saved. Please retry.');
}
