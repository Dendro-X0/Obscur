"use client";

export type InvitationComposerValues = Readonly<{
  intro: string;
  note: string;
  secretCode: string;
}>;

export const DEFAULT_INVITATION_INTRO = "Hello! I'd like to connect on Obscur.";

export const buildInvitationRequestMessage = (values: InvitationComposerValues): string => {
  const intro = values.intro.trim() || DEFAULT_INVITATION_INTRO;
  const note = values.note.trim();
  const secretCode = values.secretCode.trim();
  const sections = [intro];

  if (note) {
    sections.push(`Note: ${note}`);
  }

  if (secretCode) {
    sections.push(`Code: ${secretCode}`);
  }

  return sections.join("\n\n");
};
