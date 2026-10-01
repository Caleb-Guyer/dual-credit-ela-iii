import Campaign, { type CampaignConfig } from '../douglass-next/Campaign';
import { missions, questions, source, passage, chapterQuestions, finalExam } from './data';
import { readSave, freshSave, recordResult, SAVE_KEY } from './save';
import Art from './Art';
import './final.css';
const config: CampaignConfig = {
  missions,
  questions,
  source,
  passage,
  chapterQuestions,
  readSave,
  freshSave,
  recordResult,
  SAVE_KEY,
  Art,
  unit: 'Chapters 9–end',
  part: 'THE FINAL ACT',
  heading: ['Freedom is', 'only the beginning.'],
  tagline: 'Work. Resist. Teach. Speak. Step into the final act.',
  previous: { href: '#douglass-4-8', label: 'Chapters 4–8' },
  ending:
    'The book closes with a pledge to truth, love, and justice. You have followed Douglass from Thomas Auld’s kitchen to an independent life and a public voice.',
  exam: finalExam,
};
export default function FinalCampaign() {
  return <Campaign config={config} />;
}
