// No verified transit provider is configured. This is application capability,
// not a claim that public transportation does not operate in this area.
export const transitAvailability = {
  status: 'unavailable',
  message: 'Verified transit routes and stops are not available in PATHFINDER yet. You can explore sample routes below.',
  demoDisclosure: 'Sample transit data only. Stops, boarding and alighting locations, schedules and transfers have not been verified. The map shows illustrative geometry, not transit navigation.',
  unsupportedJourney: 'Only SM City Masinag ↔ Cogeo Gate 2 is available in the sample demonstration. Verified transit discovery is unavailable; this does not mean no public transport operates here.',
} as const;
