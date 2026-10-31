export interface Question {
  q: string;
  a: string[];
  c: number | number[];
  multi?: boolean;
  e: string;
}

export const questions: Question[] = [
  // Foundational Questions (1-10)
  {
    q: 'What is a prompt best described as in this course?',
    a: ['A delegation brief that tells AI what to do and how', 'A guarantee that the AI answer is correct', 'A company approval for AI use'],
    c: 0,
    e: 'A prompt is the instruction, question, and background you provide to guide the AI.'
  },
  {
    q: 'Which sequence matches the five-part prompt checklist?',
    a: ['Task, context, constraints, format, verification', 'Context, answer, approval, format, summary', 'Task, confidence, speed, format, disclosure'],
    c: 0,
    e: 'The checklist is task, context, constraints, format, and verification.'
  },
  {
    q: 'Why can a vague prompt lead to a convincing but false answer?',
    a: ['AI may fill missing details by guessing', 'AI always searches company records', 'AI refuses to answer without a format'],
    c: 0,
    e: 'When context is missing, generative AI may make assumptions and present them confidently.'
  },
  {
    q: 'What should a prompt request when report information is missing?',
    a: ['Ask the AI to infer a likely value', 'Ask it to mark the information “not provided”', 'Ask it to use a typical value'],
    c: 1,
    e: 'The source recommends explicitly marking missing information as “not provided.”'
  },
  {
    q: 'How should you verify an AI-generated report?',
    a: ['Compare it with the original notes and check details', 'Rely on its confident tone', 'Review only its formatting'],
    c: 0,
    e: 'Check dates, names, measurements, unsupported claims, format, and the source notes.'
  },
  {
    q: 'When may sensitive information be uploaded to an AI tool?',
    a: ['Whenever it saves time', 'Only after proper authorization', 'If names are not in the prompt'],
    c: 1,
    e: 'The source says not to upload sensitive information without proper authorization.'
  },
  {
    q: 'What is the “think” rule asking you to do?',
    a: ['Accept findings that look polished', 'Understand and evaluate findings yourself', 'Ask AI to make the final decision'],
    c: 1,
    e: 'If you cannot explain a finding yourself, do not accept it.'
  },
  {
    q: 'Who has ultimate responsibility for work produced with AI assistance?',
    a: ['The AI tool provider', 'The person presenting the work', 'The person who wrote the prompt only'],
    c: 1,
    e: 'The responsible staff member must verify and approve the work.'
  },
  {
    q: 'Which item must an AI never invent in a high-risk project report?',
    a: ['A requested heading', 'A measurement not provided in the notes', 'A verification checklist'],
    c: 1,
    e: 'The source warns against invented measurements, observations, causes, instructions, policies, actions, or approvals.'
  },

  // Applied Scenario Questions (11-21)
  {
    q: 'A project manager writes the following prompt: "Draft a project update email based on the attached meeting notes. Use bullet points under two headings: Completed Tasks and Next Steps. Do not include any budget estimations or cost projections that are not explicitly stated in the notes." Which part of the five-part prompt framework is represented by the instruction prohibiting unstated budget estimations?',
    a: ['Constraints', 'Verification', 'Task', 'Context'],
    c: 0,
    e: 'Explicitly prohibiting unstated budget estimations sets negative boundaries on what the AI must not invent, which represents the Constraints component.'
  },
  {
    q: 'According to structured prompt design principles, which of the following are essential components of the five-part prompt framework? (Select all that apply.)',
    a: [
      'Defining the specific Task to be produced',
      'Allowing the AI model to establish its own default tone and rules',
      'Specifying mandatory Constraints on what the AI must avoid inventing',
      'Setting exact Format requirements for how the output is structured'
    ],
    c: [0, 2, 3],
    multi: true,
    e: 'The five-part prompt framework includes Task, Context, Constraints, Format, and Verification. Allowing the AI to guess default tone and rules is contrary to effective prompt design.'
  },
  {
    q: 'A site auditor enters the prompt "Write a site inspection report" into an AI system. Why is this considered a weak prompt in a workplace setting?',
    a: [
      'It uses clear technical jargon that confuses generative language models.',
      'It triggers safety fallback filters by requesting a formal technical document.',
      'It leaves context, constraints, format, and verification rules completely open, forcing the AI to guess missing facts.',
      'Generative AI models are incapable of writing long-form reports without specialized coding scripts.'
    ],
    c: 2,
    e: 'A vague prompt without context, boundaries, format, or verification forces the AI to fill the gaps by guessing, risking confabulation.'
  },
  {
    q: 'Consider two prompts sent to an AI assistant:\nPrompt A: "Write an email about staff expenses."\nPrompt B: "Draft a reminder email for monthly expense submissions due on the 25th for Chify Nigeria Limited. Use a respectful tone, include placeholders for submission methods, and do not invent company policies or penalties. End with a missing-information checklist."\nWhy is Prompt B significantly better for workplace administration?',
    a: [
      'Prompt B provides explicit boundaries and accuracy controls, preventing the creation of unverified policies.',
      'Prompt B is shorter, allowing the AI to process response tokens faster.',
      'Prompt B allows the AI to suggest sensible general policies like requiring prior approval.',
      'Prompt B forces the AI model to access real-time internal company databases directly.'
    ],
    c: 0,
    e: 'Prompt B supplies the audience, exact deadline, placeholders, negative constraints, and a verification checklist, preventing invented policies.'
  },
  {
    q: 'A common misconception is that if an AI model produces a coherent response with detailed citations and logical reasoning, the response must be factually true. What technical phenomenon explains why this is incorrect?',
    a: [
      'Confabulation (hallucination), where models generate plausible-sounding but factually false outputs based on statistical token prediction',
      'Model collapse, caused by operating on low-temperature parameter settings',
      'Code execution error, where Python tools miscalculate text probabilities',
      'Algorithmic aversion, where models deliberately alter facts to test human oversight'
    ],
    c: 0,
    e: 'Generative models predict probable next words; they can construct convincing, fluent sentences that are factually false (confabulation/hallucination).'
  },
  {
    q: 'Which of the following statements represents a dangerous workplace misconception regarding AI-generated documents?',
    a: [
      'Human expertise is required to verify measurements and factual claims before final approval.',
      'AI outputs are automatically accurate and approved for management submission once generated.',
      'AI tools can assist in organizing raw field notes into structured report templates.',
      'AI-generated documents should be treated as preliminary drafts that require human review.'
    ],
    c: 1,
    e: 'Believing AI outputs are automatically accurate and ready for submission without verification is a critical workplace risk.'
  },
  {
    q: 'An employee prompts an AI: "Draft a site inspection report from my notes." The notes contain site observations but omit the inspection date and site ID. How SHOULD a properly constrained AI handle this missing information?',
    a: [
      'It should leave the entire report blank until all possible fields are populated.',
      'It should replace the missing details with standard default administrative templates.',
      'It should flag the missing information as "Not provided" or ask the user for clarification.',
      'It should generate a plausible date and site ID based on recent calendar data.'
    ],
    c: 2,
    e: 'Properly constrained prompts instruct the AI to explicitly mark unstated information as "Not provided" rather than inferring or inventing values.'
  },
  {
    q: 'According to NIST guidelines and workplace AI safeguards, why can a generated response\'s step-by-step logical explanation be misleading?',
    a: [
      'LLMs can produce convincing logical steps explaining how they reached an answer even when the answer itself is factually incorrect.',
      'Step-by-step explanations indicate that the model accessed real-time external database ground truth.',
      'Logical explanations automatically override user-defined negative constraints.',
      'AI systems use logical steps only when attempting to execute prompt injection attacks.'
    ],
    c: 0,
    e: 'A coherent tone and persuasive chain of reasoning do not guarantee factual accuracy; plausible steps can lead to fabricated conclusions.'
  },
  {
    q: 'A supervisor is conducting "Verification in Practice" on an AI-generated site report. Which of the following actions represents a proper human review procedure?',
    a: [
      'Comparing the report directly against original field notes to confirm measurements, dates, and names.',
      'Checking the document layout while assuming all dates and measurements are accurate.',
      'Relying on the AI\'s self-generated missing-information checklist as final proof of complete accuracy.',
      'Approving recommendations without distinguishing them from verified factual observations.'
    ],
    c: 0,
    e: 'Rigorous human verification requires cross-checking the AI draft side-by-side against original source notes for dates, names, and measurements.'
  },
  {
    q: 'When generating workplace reports, which of the following items must an AI NEVER invent or fabricate if missing from the source context? (Select all that apply.)',
    a: [
      'Site measurements and numerical readings',
      'Structural headings and bulleted formatting',
      'Client instructions and official approvals',
      'Company policies or disciplinary penalties'
    ],
    c: [0, 2, 3],
    multi: true,
    e: 'AI must never invent high-risk factual elements such as measurements, client instructions, approvals, or policies. Structural formatting, however, is standard to specify.'
  },
  {
    q: 'According to core AI governance principles, what action must the team take prior to uploading this information?',
    a: [
      'Uploading the data during off-peak hours to minimize the risk of external network intercepts.',
      'Allowing the generative AI system to auto-redact names while assuming all other proprietary data is safe.',
      'Summarizing the confidential data into shorthand notes prior to upload without seeking organizational permission.',
      'Confirming that explicit authorization has been granted and ensuring confidential data is protected.'
    ],
    c: 3,
    e: 'Sensitive, proprietary, or confidential data must never be uploaded to an AI tool without explicit authorization and verifiable data protection.'
  }
];

export function calculateScore(answers: Record<number, number | number[]>): number {
  return questions.reduce((score, q, i) => {
    const userAns = answers[i];
    if (userAns === undefined) return score;

    if (q.multi) {
      if (!Array.isArray(userAns)) return score;
      const sortedUser = [...userAns].sort((a, b) => a - b);
      const sortedCorrect = [...(q.c as number[])].sort((a, b) => a - b);
      const isMatch = sortedUser.length === sortedCorrect.length && sortedUser.every((v, idx) => v === sortedCorrect[idx]);
      return score + (isMatch ? 1 : 0);
    }

    return score + (userAns === q.c ? 1 : 0);
  }, 0);
}
