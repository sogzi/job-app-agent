// Contact details the autofill puts into application forms. Set these in .env.local.
export function getApplicantContact() {
  const env = process.env;
  return {
    full_name: env.APPLICANT_FULL_NAME ?? "",
    email: env.APPLICANT_EMAIL ?? "",
    phone: env.APPLICANT_PHONE ?? "",
    location: env.APPLICANT_LOCATION ?? "",
    linkedin: env.APPLICANT_LINKEDIN ?? "",
    website: env.APPLICANT_WEBSITE ?? "",
  };
}

// Absolute path to the CV file uploaded into résumé fields.
export function getCvPath(): string | null {
  return process.env.APPLICANT_CV_PATH || null;
}
