export const MEETING_PROVIDERS = {
  ANY: 'any',
  GOOGLE_MEET: 'google_meet',
  ZOOM: 'zoom',
  TEAMS: 'teams',
};

export const meetingProviderOptions = [
  { value: MEETING_PROVIDERS.ANY, label: 'Any provider' },
  { value: MEETING_PROVIDERS.GOOGLE_MEET, label: 'Google Meet' },
  { value: MEETING_PROVIDERS.ZOOM, label: 'Zoom' },
  { value: MEETING_PROVIDERS.TEAMS, label: 'Microsoft Teams' },
];

export function getMeetingProviderLabel(value) {
  const found = meetingProviderOptions.find((option) => option.value === value);
  return found?.label || 'Not set';
}
