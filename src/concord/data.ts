import sourceParagraphs from './source.json' with { type: 'json' };

export type Evidence = {
  id: string;
  title: string;
  quote: string;
  meaning: string;
  paragraph: number;
  topic: string;
};
export type Question = {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  distractors: string[];
  paragraph: number;
};
export type DebateRound = {
  objection: string;
  claims: { text: string; correct: boolean; explanation: string }[];
  evidenceId: string;
  explanation: string;
};
export type Debate = {
  id: number;
  title: string;
  speaker: string;
  role: string;
  intro: string;
  rounds: DebateRound[];
};

/** Internal paragraph / verse-block numbers, not page numbers in any classroom edition. */
export const source: { id: number; text: string }[] = sourceParagraphs;
export const passage = (id: number): string => source.find((p) => p.id === id)?.text ?? '';
export const topics = [
  'Government & conscience',
  'Majority & voting',
  'Complicity & action',
  'Taxes & resistance',
  'Prison & perspective',
  'Close-reading details',
  'Rhetoric & vocabulary',
  'Reform & the individual',
];

export const evidence: Evidence[] = [
  {
    id: 'c01',
    title: 'Conscience before compliance',
    quote: 'I think that we should be men first, and subjects afterward.',
    meaning:
      'Being a moral person comes before being an obedient subject. A law cannot take over your responsibility to judge right and wrong.',
    paragraph: 4,
    topic: topics[0],
  },
  {
    id: 'c02',
    title: 'Power is not justice',
    quote:
      'But a government in which the majority rule in all cases can not be based on justice, even as far as men understand it.',
    meaning:
      'A majority can enforce a decision because it is stronger. Numerical strength does not establish that a decision is morally right.',
    paragraph: 4,
    topic: topics[1],
  },
  {
    id: 'c03',
    title: 'People, not machines',
    quote:
      'The mass of men serve the State thus, not as men mainly, but as machines, with their bodies.',
    meaning:
      'Unthinking obedience turns people into instruments. Thoreau distinguishes serving with the body, the head, and the conscience.',
    paragraph: 6,
    topic: topics[0],
  },
  {
    id: 'c04',
    title: 'Withdraw your support',
    quote:
      'but it is his duty, at least, to wash his hands of it, and, if he gives it no thought longer, not to give it practically his support.',
    meaning:
      'You may not be able to fix every wrong, but you must stop contributing to the wrong you condemn. Private disapproval alone is insufficient.',
    paragraph: 17,
    topic: topics[2],
  },
  {
    id: 'c05',
    title: 'Become counter friction',
    quote: 'Let your life be a counter friction to stop the machine.',
    meaning:
      'When the system requires you to act as an agent of injustice, interrupt your own participation. The machinery is a metaphor for government.',
    paragraph: 22,
    topic: topics[2],
  },
  {
    id: 'c06',
    title: 'A majority of one',
    quote: 'Moreover, any man more right than his neighbors constitutes a majority of one already.',
    meaning:
      'A person acting rightly has moral authority without first winning a numerical majority. This is a paradox, not a claim about counting votes.',
    paragraph: 24,
    topic: topics[1],
  },
  {
    id: 'c07',
    title: 'An honorable prison',
    quote:
      'Under a government which imprisons any unjustly, the true place for a just man is also a prison.',
    meaning:
      'Imprisonment for refusing complicity can express solidarity and integrity. Jail is not automatically proof that a person is wrong.',
    paragraph: 26,
    topic: topics[4],
  },
  {
    id: 'c08',
    title: 'The limits of walls',
    quote:
      'I could not but smile to see how industriously they locked the door on my meditations, which followed them out again without let or hindrance, and they were really all that was dangerous.',
    meaning:
      'The state can confine his body but cannot contain his thought. The apparent prisoner can be freer in conscience than the people outside.',
    paragraph: 30,
    topic: topics[4],
  },
  {
    id: 'c09',
    title: 'Force is not truth',
    quote: 'It is not armed with superior wit or honesty, but with superior physical strength.',
    meaning:
      'Coercive strength is different from intellectual or moral authority. Thoreau refuses to treat force as a valid moral argument.',
    paragraph: 31,
    topic: topics[4],
  },
  {
    id: 'c10',
    title: 'A better government',
    quote: 'I ask for, not at once no government, but at once a better government.',
    meaning:
      'His immediate practical demand is improvement. The opening ideal of governing not at all is conditional on people being prepared.',
    paragraph: 3,
    topic: topics[7],
  },
  {
    id: 'c11',
    title: 'Neighbor and subject',
    quote:
      'I have never declined paying the highway tax, because I am as desirous of being a good neighbor as I am of being a bad subject;',
    meaning:
      'His resistance is selective and principled. He still supports neighborly duties, roads, and education rather than rejecting all communal responsibility.',
    paragraph: 40,
    topic: topics[3],
  },
  {
    id: 'c12',
    title: 'The source of authority',
    quote: 'to be strictly just, it must have the sanction and consent of the governed.',
    meaning:
      'A just state derives authority from individuals and respects their independent power. Democracy is a step toward that ideal, not the final possible improvement.',
    paragraph: 51,
    topic: topics[7],
  },
];

const bank: Question[] = [];
function q(
  topic: number,
  paragraph: number,
  prompt: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
  whyWrong: [string, string, string],
) {
  const index = bank.length;
  const answer = index % 4;
  const options = [...wrong];
  options.splice(answer, 0, correct);
  const distractors = [...whyWrong];
  distractors.splice(answer, 0, explanation);
  bank.push({
    id: `q${String(index + 1).padStart(3, '0')}`,
    topic: topics[topic],
    prompt,
    options,
    answer,
    explanation,
    distractors,
    paragraph,
  });
}

// Government & conscience: foundations, qualifications, and important distinctions.
q(
  0,
  1,
  'What qualification accompanies the opening ideal of a government that governs not at all?',
  'People must first be prepared for that kind of government.',
  [
    'All existing government must disappear immediately.',
    'The ideal applies only during wartime.',
    'Only legislators can decide whether people are prepared.',
  ],
  'Thoreau explicitly places the ideal in a future when people are prepared. The sentence does not announce an immediate practical plan to abolish every institution.',
  [
    'The opening includes a condition rather than an immediate abolition order.',
    'No wartime exception is attached to this ideal.',
    'He does not assign this judgment exclusively to legislators.',
  ],
);
q(
  0,
  3,
  'What does Thoreau ask for immediately, speaking practically as a citizen?',
  'A better government.',
  [
    'No government of any kind at once.',
    'A stronger standing army.',
    'A monarchy instead of a republic.',
  ],
  'He separates his immediate demand for better government from the ultimate ideal stated at the opening. This distinction prevents an oversimplified reading of his politics.',
  [
    'He explicitly contrasts this with his immediate request.',
    'His discussion of a standing army criticizes its susceptibility to misuse.',
    'He does not propose replacing the republic with a monarchy.',
  ],
);
q(
  0,
  4,
  'What does being a person first and a subject afterward mean in the argument?',
  'Moral judgment takes priority over obedience to government.',
  [
    'Citizens should obey only laws that benefit them financially.',
    'Citizens have no responsibilities toward other people.',
    'Political officials possess a superior conscience.',
  ],
  'The contrast establishes conscience as a responsibility the individual cannot simply transfer to a legislator. It is an ethical priority rather than a license for selfish convenience.',
  [
    'Financial self-interest is not his criterion for justice.',
    'His argument preserves duties toward neighbors and fellow human beings.',
    'He challenges the surrender of conscience to officials.',
  ],
);
q(
  0,
  4,
  'Why can even well-disposed people become agents of injustice?',
  'They can obey the law without examining whether it is right.',
  [
    'They must secretly want every harmful consequence.',
    'They lack the right to think about public affairs.',
    'They have not yet won a majority of votes.',
  ],
  'Good intentions do not prevent harmful complicity when a person treats legality as sufficient moral justification. Thoreau emphasizes the effects of obedience.',
  [
    'His point is precisely that people can participate without malicious intentions.',
    'He insists that individuals exercise moral judgment.',
    'A majority is not a prerequisite for avoiding complicity.',
  ],
);
q(
  0,
  6,
  'Which three ways of serving the state does Thoreau distinguish?',
  'With the body, the head, and the conscience.',
  [
    'With money, land, and inheritance.',
    'As voters, judges, and presidents.',
    'Through fear, friendship, and patriotism.',
  ],
  'The categories contrast mechanical service, intellectual service without reliable moral discrimination, and conscientious service that may require resistance.',
  [
    'These are forms of property, not his three categories of service.',
    'His categories concern faculties people use, not three political offices.',
    'These motives do not reproduce his body-head-conscience distinction.',
  ],
);
q(
  0,
  6,
  'Why may conscientious reformers be treated as enemies by the state?',
  'Their moral judgment often requires resisting it.',
  [
    'They necessarily oppose every useful public institution.',
    'They are always foreign citizens.',
    'They are unable to understand any law.',
  ],
  'Those who serve with conscience do not automatically endorse what the state does. The irony is that morally serious service can look like disloyalty to an unjust institution.',
  [
    'Principled resistance is not a rejection of every institution.',
    'The passage makes no citizenship-based distinction of this kind.',
    'Resistance here follows moral understanding, not an inability to read law.',
  ],
);
q(
  0,
  1,
  'Which event illustrates government being used as a tool by a comparatively small number of people?',
  'The war against Mexico.',
  ['The American Revolution of 1775.', 'The Boston Tea Party.', 'The building of a local highway.'],
  'The opening names the Mexican war as an example of a few individuals using standing government before the people could act through it.',
  [
    'The Revolution appears elsewhere as an accepted example of resistance.',
    'This event is not the example in the opening passage.',
    'Highway support appears later in a different argument about neighborly duties.',
  ],
);
q(
  0,
  2,
  'To what does Thoreau chiefly credit American achievements such as education and keeping the country free?',
  'The character of the American people.',
  [
    'The inherent wisdom of every law.',
    'The standing army alone.',
    'Government acting without any individual initiative.',
  ],
  'He argues that people accomplished these things and that government sometimes hindered them. This supports his preference for government that does not obstruct human activity.',
  [
    'He disputes the assumption that law automatically creates justice or achievement.',
    'He does not give the army sole credit for these achievements.',
    'This reverses his emphasis on the people themselves.',
  ],
);
q(
  0,
  4,
  'What does Thoreau say a corporation of conscientious people can possess?',
  'A conscience, through the people composing it.',
  [
    'Automatic moral superiority to every individual.',
    'A right to ignore all moral questions.',
    'Justice simply because it has legal status.',
  ],
  'He qualifies the familiar claim that a corporation has no conscience: conscientious members can give it one. Institutions still depend on individual moral agency.',
  [
    'He does not make collective size a guarantee of moral superiority.',
    'The qualification demands moral judgment rather than dispensing with it.',
    'Legal incorporation alone does not supply conscience.',
  ],
);

// Majority & voting.
q(
  1,
  4,
  'According to Thoreau, what practical fact explains why majorities keep ruling?',
  'They are physically strongest.',
  [
    'They are always morally right.',
    'They invariably protect minorities fairly.',
    'They have studied every issue most carefully.',
  ],
  'He separates the ability to enforce a decision from justice. Numerical strength is his explanation of majority power, not a proof of moral authority.',
  [
    'He explicitly denies that majority rule is justified by always being right.',
    'Fairness to minorities is not his stated practical explanation.',
    'The passage does not attribute superior knowledge to every majority.',
  ],
);
q(
  1,
  4,
  'Which decisions does Thoreau suggest majorities might properly make?',
  'Questions to which expediency applies, rather than ultimate right and wrong.',
  [
    'Every moral question without exception.',
    'Only questions of private religious belief.',
    'No collective decision under any circumstances.',
  ],
  'He imagines a division between practical arrangements and moral judgment. His criticism of majority rule does not erase every possible practical use of voting.',
  [
    'His distinction specifically challenges this unlimited moral authority.',
    'He does not reserve majority decision for private belief.',
    'He leaves room for majority decisions about expediency.',
  ],
);
q(
  1,
  15,
  'Why does Thoreau compare voting to checkers or backgammon?',
  'It can leave right and wrong to chance and majority outcomes without staking the voter personally.',
  [
    'He thinks all election officials literally gamble with ballots.',
    'He wants citizens to replace elections with board games.',
    'He says voting always forces immediate moral action.',
  ],
  'The gaming analogy criticizes a weak moral commitment: a voter expresses a preference but may leave the right to prevail by chance. The target is reliance on voting as sufficient action.',
  [
    'The comparison is an analogy, not an allegation of literal ballot gambling.',
    'The named games illustrate his argument; they are not a proposed electoral system.',
    'His objection is that voting can avoid personal commitment.',
  ],
);
q(
  1,
  15,
  'Why does merely voting for what is right fall short in this essay?',
  'It may express a wish without taking responsibility for making right prevail.',
  [
    'Only wealthy voters are allowed to have moral opinions.',
    'A vote always legally obliges its caster to commit violence.',
    'Thoreau believes wrong choices are better than correct votes.',
  ],
  "He distinguishes expressing a preference from putting one's character and influence behind it. The passage demands action beyond a cheap or passive vote.",
  [
    'The criticism is about commitment, not a wealth qualification for conscience.',
    'He does not claim that every ballot creates this legal obligation.',
    'He favors right action; he does not prefer deliberately wrong choices.',
  ],
);
q(
  1,
  24,
  'What does the paradox of a majority of one emphasize?',
  'One person can possess moral rightness without numerical support.',
  [
    'A single ballot literally counts as more than every other ballot.',
    'One person should be made an absolute monarch.',
    'Everyone is equally right on every question.',
  ],
  'The paradox transfers the language of political strength to moral authority. The person need not wait for neighbors to agree before withdrawing support from injustice.',
  [
    'The phrase concerns conscience, not arithmetic or ballot weighting.',
    'He does not turn principled individuality into a demand for monarchy.',
    'The phrase assumes a meaningful distinction between right and wrong.',
  ],
);
q(
  1,
  26,
  "When does a minority become powerful in Thoreau's description?",
  'When it stops conforming and obstructs injustice with its full weight.',
  [
    'When it quietly imitates the majority.',
    'Only after it ceases to be a numerical minority.',
    'When it abandons every principle for popularity.',
  ],
  'A conforming minority has no effective independent force. Refusing cooperation gives its convictions practical consequences.',
  [
    'He says a conforming minority is not effectively a minority at all.',
    'He argues that action can begin before numerical majority is obtained.',
    'Abandoning principle would remove the independent resistance he describes.',
  ],
);
q(
  1,
  26,
  'What does casting your whole vote mean in context?',
  'Committing your whole influence rather than merely a paper ballot.',
  [
    'Submitting duplicate ballots.',
    'Voting only on tax legislation.',
    'Letting an officer decide what you believe.',
  ],
  'The metaphor expands voting into committed conduct. It appears in an argument that influence can continue even from prison.',
  [
    'The passage is about the extent of moral commitment, not duplicate voting.',
    'The phrase is not restricted to a particular ballot issue.',
    'Surrendering judgment contradicts the appeal to personal influence.',
  ],
);
q(
  1,
  16,
  'What does Thoreau criticize about choosing the only available presidential candidate?',
  'Independent people can let professional politicians limit their judgment.',
  [
    'Candidates are selected by prisoners rather than conventions.',
    'No independent person ever considers politics.',
    'A chosen candidate must automatically be the wisest individual.',
  ],
  "He attacks the respectable voter who accepts a convention's options as final and abandons independence. Availability is not the same as moral worth.",
  [
    'The paragraph describes conventions of editors and professional politicians.',
    'His complaint is that intelligent people surrender judgment when they do participate.',
    'He questions precisely that assumption of suitability.',
  ],
);
q(
  1,
  14,
  'Why is absolute goodness somewhere more important than many people being comparatively good?',
  'Principled action can begin with a few and influence the larger community.',
  [
    'Public opinion has already made all necessary reforms.',
    'A large crowd automatically purifies every wrong action.',
    'Moral improvement requires everyone to wait for everyone else.',
  ],
  'The leaven image gives a small amount of genuine goodness transformative potential. This connects to refusing to wait for a majority before doing right.',
  [
    'He criticizes the continuing failure of passive public opinion.',
    'Crowd size does not establish moral rightness in the essay.',
    'Mutual waiting is the very paralysis he opposes.',
  ],
);

// Complicity & action.
q(
  2,
  9,
  'Which institution makes Thoreau refuse to recognize the American government as his own?',
  'Slavery.',
  ['Public schools.', 'Road maintenance.', 'The town clock.'],
  'He refuses allegiance to a political organization that is also the government of enslavers. The objection concerns fundamental injustice, not public services in general.',
  [
    'He later describes educating fellow citizens as part of his own contribution.',
    'He explicitly says he has not refused the highway tax.',
    'The town clock appears in his prison recollections, not as the ground of refusal.',
  ],
);
q(
  2,
  10,
  'Which pairing best captures the urgent injustices behind the essay?',
  'Slavery and the invasion of Mexico.',
  [
    'Road tolls and the shortage of schools.',
    'Monarchy and a ban on all voting.',
    'A personal property dispute and a stolen shoe.',
  ],
  "Thoreau joins domestic slavery with the nation's aggression against Mexico. He considers these organized wrongs rather than merely inconvenient policies.",
  [
    'These are not his paired examples of urgent national injustice.',
    'The essay does not frame its crisis as this pair of political conditions.',
    'The shoe is a biographical detail; it is not a theft or the moral cause of refusal.',
  ],
);
q(
  2,
  14,
  'Why does he direct criticism toward Massachusetts merchants and farmers?',
  'Their cooperation and economic priorities help sustain distant injustice.',
  [
    'They are the only people legally allowed to vote.',
    'He believes farming is inherently immoral.',
    'He says all injustice originates outside Massachusetts.',
  ],
  'The passage shifts attention from distant wrongdoers to nearby people who enable them. Private commercial interests can outweigh publicly professed humanity.',
  [
    'No exclusive voting privilege is the basis of this passage.',
    'He criticizes priorities and cooperation with injustice, not agriculture in itself.',
    'He insists that local cooperation is part of the problem.',
  ],
);
q(
  2,
  17,
  'What minimum duty remains even if a person cannot devote a life to eliminating every wrong?',
  'Stop giving practical support to the wrong.',
  [
    'Keep supporting it while privately regretting it.',
    'Solve every injustice before pursuing any other concern.',
    'Transfer all moral responsibility to elected leaders.',
  ],
  'He distinguishes the impossible demand to do everything from the attainable duty not to become an accomplice. Withdrawal of support is the minimum he identifies.',
  [
    'Private regret does not cancel the practical effects of support.',
    'He explicitly allows that a person may properly have other concerns.',
    'He refuses to let individuals surrender conscience to officials.',
  ],
);
q(
  2,
  17,
  "What inconsistency does he find in people who refuse to march to Mexico but still pay for the government's war?",
  'Their money can furnish a substitute for the service they condemn.',
  [
    'They are secretly required to be soldiers themselves.',
    'They have stopped supporting the war in every practical way.',
    'They cannot have any opinion about a war they do not personally fight.',
  ],
  "He traces indirect participation through allegiance and money. Refusing personal military service does not by itself end one's practical support.",
  [
    'The argument concerns indirect support even without personal military service.',
    'The payment is his example of support continuing.',
    'He asks them to make opinion consistent with action, not to remain silent.',
  ],
);
q(
  2,
  19,
  'Why does he introduce the example of a neighbor who cheats you out of a dollar?',
  'To contrast effective action with merely knowing or complaining that a wrong occurred.',
  [
    'To make recovering money the only moral duty.',
    'To establish that every neighbor is dishonest.',
    'To argue that petitions are always sufficient.',
  ],
  'The familiar personal example exposes the weakness of passive responses to larger injustice. People act to correct a private loss but often stop at opinions about public wrongs.',
  [
    'The dollar example illustrates a broader moral argument, not an exclusive duty.',
    'The example is hypothetical and does not accuse every neighbor.',
    'He contrasts petitioning alone with effectual steps.',
  ],
);
q(
  2,
  20,
  'Why does Thoreau reject waiting until a majority has amended an unjust law?',
  "Waiting can prolong one's participation in the injustice.",
  [
    'He believes a law becomes just as soon as it is printed.',
    'He thinks every proposed remedy is more harmful than injustice.',
    'He wants to surrender judgment to the same majority.',
  ],
  'The essay challenges compliance during indefinite reform efforts. When obedience makes a person an agent of wrong, moral action cannot simply be postponed.',
  [
    'Printing or enacting a law does not establish moral rightness.',
    'He disputes the automatic assumption that resistance is the worse evil.',
    'The point is to retain judgment rather than wait for majority permission.',
  ],
);
q(
  2,
  22,
  'What condition specifically leads to the instruction to break the law?',
  'The law requires you to become an agent of injustice to another person.',
  [
    'You dislike any inconvenience caused by government.',
    'You stand to earn more money by disobeying.',
    'You have received approval from every neighbor.',
  ],
  'Thoreau distinguishes ordinary friction from being made an instrument of injustice. The condition is morally specific and does not endorse arbitrary lawbreaking.',
  [
    'He distinguishes tolerable friction from this more serious condition.',
    'Profit is not his criterion for resistance.',
    'He explicitly allows right action before neighbors agree.',
  ],
);
q(
  2,
  23,
  'What does the claim that a person has something, rather than everything, to do support?',
  'Limited power does not excuse doing something wrong.',
  [
    'Only someone capable of fixing everything may resist.',
    'Every citizen must abandon all personal work.',
    'There is no practical duty when a problem is large.',
  ],
  "Thoreau responds to the scale of injustice by focusing on one's own conduct. Being unable to do everything does not make harmful participation necessary.",
  [
    'His reasoning makes action possible despite limited individual capacity.',
    'He says he has other affairs and does not demand universal abandonment of them.',
    'He derives a concrete personal responsibility from the limitation.',
  ],
);

// Taxes & resistance.
q(
  3,
  30,
  'Which tax does Thoreau report not paying for six years?',
  'The poll tax.',
  ['The highway tax.', 'A tax on his mended shoe.', 'An inheritance tax.'],
  'His imprisonment account specifically names six years of unpaid poll tax. Do not confuse it with the highway tax, which he says he has paid.',
  [
    'He explicitly says he has never declined paying this tax.',
    'The shoe explains his errand, not a special tax.',
    'An inheritance tax is not the tax named in this account.',
  ],
);
q(
  3,
  25,
  "Why is the tax collector important to Thoreau's argument?",
  'He is the concrete human representative through whom Thoreau meets the state.',
  [
    'He is an imaginary symbol with no personal choices.',
    'He can personally rewrite every federal law.',
    'He is blamed for independently starting the Mexican war.',
  ],
  'Thoreau insists that he deals with people rather than parchment. The collector has chosen an official role and can be asked to consider its moral implications.',
  [
    "The passage emphasizes the collector's human agency and neighborly relationship.",
    'The argument does not grant the collector unlimited legislative power.',
    'The collector represents an institution; he is not named as the sole originator of war.',
  ],
);
q(
  3,
  26,
  'What response does Thoreau give an officer who genuinely wants to do something about injustice?',
  'Resign the office.',
  [
    'Collect the same tax more efficiently.',
    'Wait until every other officer resigns first.',
    'Imprison the person who objects.',
  ],
  "He pairs a subject's refusal of allegiance with an officer's withdrawal from enforcing injustice. Both actions remove practical support.",
  [
    'Greater efficiency would continue the enforcement he challenges.',
    'He does not require unanimous prior action.',
    'That would perpetuate the coercion under discussion.',
  ],
);
q(
  3,
  26,
  'Why can refusing a tax be less violent than paying it in his argument?',
  'Payment can enable state violence and the shedding of innocent blood.',
  [
    'Refusal guarantees there will never be any consequences.',
    'All money is inherently physically violent.',
    'He regards all refusal as a literal armed attack.',
  ],
  'Thoreau asks the reader to consider what compliance supports, rather than assuming only resistance causes harm. He calls the collective refusal a possible peaceable revolution.',
  [
    'He openly considers imprisonment and other penalties.',
    'He later calls the dollar innocent and focuses on allegiance.',
    'The passage specifically contrasts this refusal with violent support.',
  ],
);
q(
  3,
  40,
  'Which tax does Thoreau explicitly say he has never declined to pay?',
  'The highway tax.',
  [
    'The poll tax.',
    'A tax for a clergyman he never heard preach.',
    'Every tax appearing in any bill.',
  ],
  'He distinguishes being a good neighbor from being a compliant subject. Supporting roads is compatible, in his account, with withdrawing allegiance from injustice.',
  [
    'His refusal of the poll tax is central to the prison account.',
    'He recounts refusing support for a church he did not join.',
    'He carefully distinguishes taxes and duties instead of accepting all of them.',
  ],
);
q(
  3,
  40,
  'Does Thoreau claim to trace his particular dollar until it purchases a weapon or an enslaved person?',
  'No; he focuses on the effects of his allegiance rather than the path of a particular dollar.',
  [
    'Yes; he claims to have tracked its exact expenditure.',
    'No; he thinks allegiance has no consequences.',
    'Yes; tracing individual coins is his only reason for objecting.',
  ],
  'He explicitly says he does not care to trace the dollar and calls it innocent. His refusal concerns the relationship of allegiance and support.',
  [
    'He expressly declines to make that claim.',
    "He contrasts the dollar's innocence with the effects of allegiance.",
    'This reverses his stated emphasis.',
  ],
);
q(
  3,
  29,
  "How did he end the town's demand that he support a particular church?",
  'He submitted a statement that he did not belong to a society he had not joined.',
  [
    'He agreed to become its minister.',
    'He paid all future church taxes in advance.',
    "He destroyed the town clerk's records.",
  ],
  "At the selectmen's request he filed a written declaration of nonmembership. He says the state did not make the same demand again afterward.",
  [
    'He declined compulsory church support rather than seeking that office.',
    'He describes refusing the demand and filing a statement, not prepaying it.',
    'He gave the clerk a written record; he did not destroy one.',
  ],
);
q(
  3,
  41,
  'Why does he criticize a person who pays his tax merely to keep him out of jail?',
  'Private sympathy may interfere with the public good and undo principled resistance.',
  [
    'He believes kindness toward any individual is always wrong.',
    'He wanted the tax collector to receive a larger payment.',
    'He thought the payment automatically reformed the state.',
  ],
  'He asks whether rescuing the individual from a consequence sustains the very injustice the refusal challenges. The distinction is between private concern and considered public responsibility.',
  [
    'He critiques the consequences of this particular help, not all kindness.',
    'The amount of revenue is not the reason he gives.',
    'Payment removes the refusal; it does not itself produce reform in his account.',
  ],
);
q(
  3,
  28,
  "What fear helps explain his neighbors' reluctance to disobey?",
  'Losing protection for property and families.',
  [
    'Being forced to become legislators.',
    'Receiving too much public education.',
    'Never being allowed to hear the town clock again.',
  ],
  'He describes neighbors who cannot spare state protection and fear the consequences for property and family. The passage shows that principled action can carry real costs.',
  [
    'This is not the practical concern he records.',
    'Schooling is not the fear identified here.',
    'The town clock belongs to a different part of the prison narrative.',
  ],
);

// Prison & perspective.
q(
  4,
  30,
  'How long does he say he spent in jail on this occasion?',
  'One night.',
  ['Six years.', 'Three months.', 'Until he was an old man.'],
  'Six years describes the period of unpaid poll tax, not the duration of confinement. The short imprisonment nevertheless transforms his perspective.',
  [
    'This confuses tax refusal with prison duration.',
    'His cellmate had been awaiting trial for about that long.',
    'The comparison with a man emerging old is a contrast, not his own history.',
  ],
);
q(
  4,
  30,
  "Why does he find the state's treatment of him foolish?",
  'It confines his body as though that could confine his moral and intellectual life.',
  [
    'The prison walls were actually too low to keep anyone inside.',
    'He believed the state could read every private thought.',
    'He thought officials had mistakenly imprisoned his dog.',
  ],
  'He sees a failure to understand what truly challenges the institution: his meditations and principles. The physical walls cannot settle a moral argument.',
  [
    'He describes substantial walls and bars, not an easy physical escape.',
    "He emphasizes the state's inability to reach his thought.",
    'The dog is part of an analogy, not a literal mistaken arrest.',
  ],
);
q(
  4,
  30,
  "How can the people outside be less free than the prisoner in Thoreau's account?",
  'They may remain bound by unexamined conformity while he keeps freedom of conscience.',
  [
    'They are all secretly serving longer jail sentences.',
    'He has acquired legal authority to command them.',
    'He can physically leave whenever he wants.',
  ],
  'The paradox distinguishes inward moral independence from outward movement. His freedom claim does not mean the cell is physically unlocked.',
  [
    'The distinction is moral rather than a claim about their hidden prison terms.',
    'He gains perspective, not legal command over his neighbors.',
    'He remains physically confined until another person pays the tax.',
  ],
);
q(
  4,
  31,
  'What does the state possess instead of superior wit or honesty?',
  'Superior physical strength.',
  [
    'An infallible conscience.',
    'A complete understanding of his meditations.',
    'The consent of every person it imprisons.',
  ],
  "Thoreau separates coercion from reason and morality. The ability to punish him does not establish that the state's position is right.",
  [
    'His criticism denies automatic moral authority.',
    'He argues that the state fails to reach his intellectual or moral self.',
    'The paragraph does not make universal consent a fact of existing coercion.',
  ],
);
q(
  4,
  26,
  'Why might prison be the proper place for a just person under an unjust government?',
  "Refusing to participate in injustice can put that person outside the state's approval.",
  [
    'Every person in any prison is necessarily innocent.',
    'The state always rewards moral goodness with confinement.',
    'Justice consists only in avoiding all consequences.',
  ],
  'The statement is conditional on a government that imprisons unjustly. It challenges equating legal punishment with moral guilt; it does not certify every prisoner.',
  [
    'The essay does not claim that every prisoner in every case is innocent.',
    'The argument concerns unjust imprisonment, not a universal reward system.',
    'He is prepared to accept penalties rather than preserve comfort at any cost.',
  ],
);
q(
  4,
  35,
  'How does the night in jail change his experience of Concord?',
  'Familiar sounds and institutions become strange and newly revealing.',
  [
    'He discovers that he has been transported to Germany.',
    'He hears no sounds from the town at all.',
    'He concludes that the town has no public institutions.',
  ],
  'He compares the experience to traveling abroad and imagines medieval scenes. These comparisons describe a new perspective on his own village.',
  [
    'The Rhine and medieval imagery are imaginative comparisons, not a literal relocation.',
    'He specifically notices the clock, voices, and neighboring inn.',
    'He says he has never seen the institutions this way before.',
  ],
);
q(
  4,
  37,
  'What changes most when he leaves jail?',
  'His perception of the town, state, and neighbors.',
  [
    'The physical common has been completely rebuilt.',
    'He has aged by decades overnight.',
    'The government has already abolished all injustice.',
  ],
  'He denies a great outward transformation but describes a deeper change in his eyes. His judgment of fair-weather friendship becomes sharper.',
  [
    'He explicitly says no comparable great change occurred on the common.',
    'The old-prisoner comparison highlights that this did not happen to him.',
    'His release is not presented as immediate national reform.',
  ],
);
q(
  4,
  37,
  "What does he mean by describing his neighbors' friendship as suitable for summer weather only?",
  'They avoid risks and may fail to support someone when conscience becomes costly.',
  [
    'They refuse to speak to anyone during the winter.',
    'They work only as professional weather observers.',
    'They have promised to protest beside him regardless of cost.',
  ],
  'The seasonal image suggests fair-weather loyalty: pleasant relations without sacrifice. He questions whether their humanity extends to property or personal risk.',
  [
    'The phrase is a metaphor for conditional support, not a literal seasonal rule.',
    "Weather is imagery here, not the neighbors' occupation.",
    'He criticizes their unwillingness to take precisely those risks.',
  ],
);
q(
  4,
  31,
  'What does the acorn-and-chestnut comparison suggest about individual life?',
  'A person should grow according to an inner nature rather than simply yielding to mass pressure.',
  [
    "All trees require the government's permission to grow.",
    'One species voluntarily stops growing to obey another.',
    'The state should control every natural difference.',
  ],
  'The seeds follow their own laws and flourish as they can. Thoreau uses their independence to reinforce his refusal to be forced into an alien way of living.',
  [
    'The natural example emphasizes growth independent of political permission.',
    'He says neither seed remains inert to make way for the other.',
    'The analogy supports inner independence rather than total standardization.',
  ],
);

// Close-reading details.
q(
  5,
  38,
  'What errand was Thoreau doing when he was put in jail?',
  'Going to collect a mended shoe.',
  [
    'Buying a new musket.',
    'Collecting unpaid wages from the jailer.',
    'Delivering a presidential ballot.',
  ],
  "He names the shoemaker's errand when describing his return to ordinary life. The detail anchors a political event in an everyday experience.",
  [
    'A musket appears in his discussion of allegiance, not as this errand.',
    'There is no wage-collection errand in the account.',
    'Voting is discussed elsewhere, but it is not the reason he was in town.',
  ],
);
q(
  5,
  38,
  'What does he do after finishing his interrupted errand?',
  'Joins a huckleberry party and goes to a field on a high hill.',
  [
    'Immediately begins another six-year prison term.',
    'Leaves permanently for Mexico.',
    "Accepts the tax collector's office.",
  ],
  'He puts on his repaired shoe and leads the waiting party to huckleberries. The scene closes with the state seemingly absent from that experience.',
  [
    'Six years refers to unpaid poll tax, not a sentence begun afterward.',
    'The essay describes a nearby field, not this permanent journey.',
    'He does not report taking the office he has challenged.',
  ],
);
q(
  5,
  32,
  'What accusation had brought his cellmate to jail?',
  'Burning a barn.',
  ['Refusing the same poll tax.', "Stealing Thoreau's shoe.", 'Forging ballots at a convention.'],
  'The cellmate says he was accused of burning a barn and denies doing it. Thoreau then speculates about drinking, smoking, and the fire; that speculation is not a proven verdict.',
  [
    "The cellmate's stated accusation differs from Thoreau's tax refusal.",
    "The shoe remains part of Thoreau's interrupted errand.",
    'This accusation is not in the prison narrative.',
  ],
);
q(
  5,
  32,
  'What distinction should a careful reader preserve about the barn fire?',
  'The cellmate denies the accusation, while Thoreau offers his own conjecture.',
  [
    'A court has already convicted the cellmate in the narrated account.',
    'The cellmate openly confesses deliberate arson.',
    'Thoreau personally witnessed the fire.',
  ],
  "The account separates reported denial from the narrator's inference. Treating conjecture as established historical fact would go beyond the passage.",
  [
    'The cellmate is still waiting for his trial.',
    'He says he never did it, rather than confessing.',
    'Thoreau bases his idea on conversation, not eyewitness testimony.',
  ],
);
q(
  5,
  32,
  "What does he notice about the cell's condition?",
  'It is whitewashed, simply furnished, and exceptionally neat.',
  [
    'It is filled with elaborate luxury furnishings.',
    'It has never been cleaned or painted.',
    'It has no windows or shared space.',
  ],
  'He notes monthly whitewashing and calls this apartment perhaps the neatest in town. The unexpected detail complicates an assumption that he describes only squalor.',
  [
    'The furnishing is specifically described as simple.',
    'He identifies a regular whitewashing schedule.',
    'The following paragraphs mention the windows occupied by the two men.',
  ],
);
q(
  5,
  36,
  'What is served for breakfast in jail?',
  'Chocolate and brown bread, with an iron spoon.',
  [
    'Coffee and white cake, with a silver fork.',
    'Only water and a bowl of rice.',
    'Huckleberries from his own field.',
  ],
  'The breakfast arrives in fitted tin pans through the door. He identifies a pint of chocolate, brown bread, and an iron spoon.',
  [
    'Each of these items differs from the narrated meal.',
    'The account supplies a different, specific breakfast.',
    'Huckleberries belong to his excursion after release.',
  ],
);
q(
  5,
  36,
  'Why does the cellmate stop him from returning leftover bread?',
  'He should save it for lunch or dinner.',
  [
    'The bread belongs to the tax collector.',
    'Returning bread would automatically extend the sentence.',
    'The jailer has offered a prize for keeping it.',
  ],
  "His companion knows the practical routines of confinement better than he does. The exchange reveals Thoreau's inexperience as a prisoner.",
  [
    'No such ownership claim explains the intervention.',
    'No legal sentence extension is stated.',
    'No prize or bargain with the jailer is mentioned.',
  ],
);
q(
  5,
  36,
  'Where does the cellmate go that morning?',
  'To work at haying in a neighboring field.',
  [
    'To vote in a national election.',
    'To attend a trial that Thoreau watches.',
    'To Mexico as a soldier.',
  ],
  "The cellmate goes out daily to work at haying and expects to return at noon. This detail is distinct from Thoreau's own later outing.",
  [
    'His described activity is field work, not voting.',
    "He is waiting for trial, but this morning's departure is for work.",
    'No military departure occurs in the scene.',
  ],
);
q(
  5,
  37,
  'Why is Thoreau released?',
  'Someone else pays the tax.',
  [
    'He changes his opinion and pays it himself.',
    'He breaks through the wall.',
    'A new law abolishes all taxes that morning.',
  ],
  'The essay says someone interfered and paid. It does not identify that person in this passage, so a reading check based on the essay should preserve that limit.',
  [
    'The payment is attributed to another person, not to his change of mind.',
    'His account contains no physical escape.',
    'He does not describe such a legal change.',
  ],
);

// Rhetoric & vocabulary.
q(
  6,
  1,
  'What does expedient most nearly mean in the opening description of government?',
  'A practical means or instrument for achieving an end.',
  [
    'An institution guaranteed to be morally perfect.',
    'A permanent law of nature.',
    'A person who deliberately avoids all activity.',
  ],
  'Calling government an expedient treats it as a tool rather than an unquestionable end in itself. The following criticism asks whether that tool actually serves its purpose.',
  [
    'Practical usefulness and moral perfection are not equivalent.',
    'An expedient is a means, not an immutable natural law.',
    'The word here describes a mechanism or means, not an inactive individual.',
  ],
);
q(
  6,
  2,
  'What is the effect of comparing government to a wooden gun?',
  "It questions the institution's apparent strength and reliability.",
  [
    'It establishes the material from which every real weapon is made.',
    'It proves government can never harm anyone.',
    "It praises the government's superior military technology.",
  ],
  'The image suggests a show of power that can fail under real strain. It contributes to his effort to strip government of unquestioned prestige.',
  [
    'The comparison is figurative rather than a manufacturing claim.',
    'The broader essay clearly recognizes coercion and harm.',
    'A wooden imitation undercuts, rather than praises, that technological superiority.',
  ],
);
q(
  6,
  22,
  'What do the machine and counter-friction images represent?',
  "A system of government and an individual's resistance to its injustice.",
  [
    'A technical manual for repairing a mill.',
    'The need to obey every mechanism without judging it.',
    'A claim that only industrial workers have moral duties.',
  ],
  'The extended metaphor makes political participation visible as parts of a mechanism. Refusing to be an agent of wrong becomes counter friction.',
  [
    'The passage uses mechanical language for an ethical and political argument.',
    'He calls for judgment about whether participation makes one an agent of injustice.',
    'The duty is not limited to a particular occupation.',
  ],
);
q(
  6,
  11,
  "What does the drowning man's plank example challenge?",
  'The idea that convenience or collective advantage can always determine moral duty.',
  [
    'The claim that one should ever return something unjustly taken.',
    'The possibility that moral action can be costly.',
    'The argument that justice applies to nations as well as people.',
  ],
  "He insists that a stolen lifesaving plank must be restored even at personal cost. The extreme case exposes a limit in Paley's appeal to expediency.",
  [
    'The example affirms the obligation to restore the plank.',
    'Cost is the point: justice may remain obligatory despite it.',
    'He explicitly extends the moral principle to a people as well as an individual.',
  ],
);
q(
  6,
  20,
  'What is the main effect of the repeated questions about how government treats reformers?',
  "They challenge complacency and expose the state's resistance to moral correction.",
  [
    'They request factual answers that the author cannot imagine.',
    'They praise government for always welcoming criticism.',
    'They abandon the subject of reform for unrelated biography.',
  ],
  'The rhetorical questions press an accusation rather than seek a list of neutral answers. The historical and religious allusions show authorities condemning figures later respected.',
  [
    'The questions function argumentatively, not as an information survey.',
    'Their examples point toward persecution and exclusion.',
    'The allusions reinforce the same argument about reform.',
  ],
);
q(
  6,
  30,
  'What kind of contradiction is created by the free prisoner and the unfree townspeople?',
  'A paradox that separates freedom of conscience from physical liberty.',
  [
    'A factual statement that nobody was actually locked up.',
    'A pun about the price of his prison breakfast.',
    'A claim that justice is determined by wall thickness.',
  ],
  'The apparent contradiction becomes meaningful once two kinds of freedom are distinguished. It is central to the moral interpretation of imprisonment.',
  [
    'His physical imprisonment remains part of the narrated facts.',
    'The contrast concerns moral independence, not a joke about a meal.',
    'Physical measurements do not supply his moral standard.',
  ],
);
q(
  6,
  19,
  'What does action from principle combine?',
  'Perceiving what is right and performing it.',
  [
    'Keeping an opinion private and avoiding every consequence.',
    'Obeying a law first and considering it only afterward.',
    'Winning an argument regardless of whether the claim is true.',
  ],
  'Thoreau defines the phrase in terms of both perception and performance. The combination explains why mere sympathy or regret does not satisfy him.',
  [
    'This omits the performance of right that his definition includes.',
    'He prioritizes moral judgment rather than automatic prior compliance.',
    'Principle concerns right conduct, not victory detached from truth.',
  ],
);
q(
  6,
  49,
  'What does the pilgrimage toward the fountain-head symbolize?',
  'Seeking a deeper source of truth beyond merely accepting inherited authorities.',
  [
    'Finding the nearest literal drinking fountain in Concord.',
    'Proving that no book can contain any wisdom.',
    'Returning without question to whatever government already exists.',
  ],
  'The stream, lake, and source form a metaphor for the search for truth. He distinguishes reverence for texts from tracing the principles behind them further.',
  [
    'The water imagery is an intellectual and moral metaphor.',
    'He acknowledges reverence and humanity in readers of the Bible and Constitution.',
    'The movement upstream questions the sufficiency of existing stopping points.',
  ],
);
q(
  6,
  26,
  'What is the wounded conscience and flowing blood image intended to emphasize?',
  'Moral injury can be a grave harm even when people overlook it.',
  [
    'Every act of conscience literally causes physical bleeding.',
    'The essay contains no concern about actual violence.',
    'A bloodless policy is automatically just.',
  ],
  'The figurative wound challenges a narrow measure of violence and harm. It follows his discussion of the harm sustained by paying for state injustice.',
  [
    'The conscience image is figurative, not a medical assertion.',
    'The passage explicitly discusses innocent blood and state violence.',
    'He asks the reader to look beyond appearances when judging harm.',
  ],
);

// Reform & the individual: the closing argument and safeguards against simplification.
q(
  7,
  42,
  'What does Thoreau warn himself to guard against?',
  "Obstinacy and an undue regard for other people's opinions.",
  [
    'Any possibility of revising his judgment.',
    'All forms of neighborly responsibility.',
    'The reading of every public law.',
  ],
  'He distinguishes principled conscience from stubborn performance or dependence on reputation. Resistance must answer to the person and the circumstances, not merely become a habit.',
  [
    'The warning encourages examination rather than forbidding reconsideration.',
    'Neighborly duties are preserved elsewhere in the essay.',
    'He does not warn against understanding the laws he evaluates.',
  ],
);
q(
  7,
  43,
  'Why does he think resistance to government differs from resistance to fire or natural forces?',
  'Government consists of human beings who can be appealed to and can change.',
  [
    'Fire is more capable of moral judgment than people.',
    'Political force has no human element at all.',
    'Natural forces always obey petitions.',
  ],
  'He can appeal to people and their moral capacities in a way he cannot appeal to fire. That difference makes resistance potentially effective rather than simply self-destructive.',
  [
    'The comparison depends on people having a moral capacity that fire lacks.',
    'He explicitly recognizes human relations within the political force.',
    'He denies that he can change rocks, trees, and beasts in this way.',
  ],
);
q(
  7,
  44,
  'How does he describe his attitude toward conforming to laws?',
  "He looks for a justifiable excuse to conform and reviews the government's conduct.",
  [
    'He refuses to consider any law under any circumstances.',
    'He obeys only to gain public admiration.',
    'He believes conformity is always the highest moral good.',
  ],
  'The paragraph complicates a caricature of Thoreau as resisting for its own sake. He says he is ready to conform, while continuing to examine whether conformity is justified.',
  [
    'He explicitly describes searching for a pretext for conformity.',
    "He warns against undue regard for others' opinions rather than making applause his aim.",
    'His willingness remains subject to conscience and judgment.',
  ],
);
q(
  7,
  46,
  'Why can he call the Constitution admirable from one point of view and inadequate from a higher one?',
  'Relative political achievements can still fall short of a more demanding moral standard.',
  [
    'He has forgotten which document he is discussing.',
    'He thinks historical progress removes the need for further reform.',
    'He regards every existing institution as equally perfect.',
  ],
  'Changing the level of evaluation explains the apparent tension. He can acknowledge real advantages without accepting existing arrangements as the final measure of justice.',
  [
    'The shift is an explicit change in perspective, not confusion.',
    'His higher perspective preserves the need for further moral judgment.',
    'His critique repeatedly distinguishes institutions from an ideal of justice.',
  ],
);
q(
  7,
  48,
  'What is the central limitation he identifies in statesmen such as Webster?',
  'They reason from inside existing institutions and may mistake constitutional consistency for justice.',
  [
    'They have no practical ability of any kind.',
    'They are all unable to speak persuasively.',
    'They always place absolute moral truth above political arrangements.',
  ],
  'Thoreau grants Webster practical strength while criticizing his inability to go behind government. Prudence and consistency with an inherited compact do not settle the moral question of slavery.',
  [
    "He expressly acknowledges useful systems and Webster's practical ability.",
    'He recognizes eloquence and practical skill rather than denying them.',
    'His objection is their failure to take that higher moral perspective.',
  ],
);
q(
  7,
  50,
  'Which priorities does he say legislators have failed to weigh properly?',
  'Free trade against freedom, and union against rectitude.',
  [
    'Breakfast against dinner, and shoes against hats.',
    'The size of barns against the number of fields.',
    'Every private preference against the town clock.',
  ],
  'The paired contrasts expose the danger of treating commerce and political union as more valuable than freedom and right conduct. They echo earlier criticism of merchants and passive reformers.',
  [
    "Those personal details do not reproduce the passage's political and moral contrasts.",
    'Agriculture appears in the essay, but not as this comparison of higher priorities.',
    'The clock is part of his prison experience, not the legislative comparison.',
  ],
);
q(
  7,
  51,
  'What must government possess to be strictly just?',
  'The sanction and consent of the governed.',
  [
    'The greatest possible army regardless of consent.',
    "An inherited claim to every person's property.",
    'The automatic approval of every earlier constitution.',
  ],
  'The conclusion derives legitimate authority from the people governed. Physical strength or inherited arrangements alone cannot provide the pure right he describes.',
  [
    'Military strength establishes coercive capacity rather than strict justice.',
    'He says rights over person and property depend on what he concedes.',
    'Historical continuity is not a substitute for consent.',
  ],
);
q(
  7,
  51,
  'How does he view democracy in the historical progress of government?',
  'As progress toward respect for individuals, with further improvement still possible.',
  [
    'As the final form beyond any possible improvement.',
    'As identical in every way to absolute monarchy.',
    'As proof that individual rights no longer matter.',
  ],
  'He describes movement from absolute monarchy to limited monarchy to democracy, then asks whether another step can be taken. The individual remains the basis of the hoped-for advance.',
  [
    'He explicitly questions whether democracy is the last improvement possible.',
    'He names the transition as progress, not identity.',
    'The conclusion centers on recognition of individual rights and authority.',
  ],
);
q(
  7,
  51,
  "What would the free and enlightened state at the essay's end recognize?",
  'The individual as a higher, independent power from which its authority derives.',
  [
    'Its own absolute right to erase every independent judgment.',
    'Only people holding public office as moral agents.',
    'Uniform allegiance as more important than every neighborly duty.',
  ],
  'The imagined state treats people with respect and can tolerate those who live aloof while fulfilling duties to others. He presents this as a future possibility he has not yet seen.',
  [
    'That would reverse his demand for respect for the individual.',
    'He grounds authority in individuals generally, not only officeholders.',
    'His imagined state allows some independence alongside fulfilled human duties.',
  ],
);

export const questions: Question[] = bank;

function round(
  objection: string,
  evidenceId: string,
  right: string,
  wrong: [string, string],
  explanation: string,
  wrongReasons: [string, string],
  position = 0,
): DebateRound {
  const claims = wrong.map((text, i) => ({ text, correct: false, explanation: wrongReasons[i] }));
  claims.splice(position, 0, { text: right, correct: true, explanation });
  return { objection, evidenceId, claims, explanation };
}

/** The speakers and debate dialogue are original teaching adaptations, not historical transcripts. */
export const debates: Debate[] = [
  {
    id: 0,
    title: 'The weight of a voice',
    speaker: 'The comfortable citizen',
    role: 'A fictional voice of conformity',
    intro:
      'The common is quiet. A neighbor asks why one person should question what everyone else accepts. Build a claim, then support it with a passage that actually proves it.',
    rounds: [
      round(
        'The law has already decided. Why should your own judgment come first?',
        'c01',
        'A person cannot hand moral responsibility over to a lawmaker.',
        [
          'Every private desire is automatically a moral principle.',
          'A law becomes right merely because it is enforced.',
        ],
        'Thoreau places being a moral person before being a subject. Conscience is a responsibility to judge right, not simply to follow personal preference.',
        [
          'Desire and conscience are not interchangeable; the essay asks whether conduct is right.',
          'Enforcement supplies power, not a moral guarantee.',
        ],
      ),
      round(
        'Surely the larger side must also be the just side.',
        'c02',
        'A majority can be stronger without being morally right.',
        [
          'The minority must be right in every disagreement.',
          'Numbers prove justice more reliably than conscience.',
        ],
        'He explains majority rule by physical strength and explicitly denies that majority decisions in every case can establish justice.',
        [
          'Being outnumbered does not by itself make a claim true.',
          'This repeats the assumption the passage challenges.',
        ],
        1,
      ),
      round(
        'A good citizen follows orders without troubling the machinery.',
        'c03',
        'Unthinking service can turn a person into an instrument of injustice.',
        [
          'People should stop using every physical tool.',
          'Any use of intelligence guarantees moral conduct.',
        ],
        'The machine comparison concerns obedience without moral judgment. Even service with the head can lack conscience.',
        [
          'The metaphor is about political and moral agency, not a ban on tools.',
          'He distinguishes cleverness from conscientious judgment.',
        ],
        2,
      ),
    ],
  },
  {
    id: 1,
    title: 'The price of assent',
    speaker: 'The tax collector',
    role: 'An adapted institutional encounter',
    intro:
      'A small demand carries a larger question: what does your cooperation sustain? These original exchanges explore the argument, rather than reenacting a documented conversation.',
    rounds: [
      round(
        'You cannot fix every wrong. Why make your refusal matter?',
        'c04',
        'I need not solve everything to stop lending my own support to injustice.',
        [
          'Until I can fix everything, any cooperation is excusable.',
          'Every citizen must abandon every other responsibility.',
        ],
        'The minimum duty is to withdraw practical support. Thoreau expressly allows other concerns while rejecting complicity.',
        [
          "Limited capacity does not remove the duty to avoid one's own participation.",
          'The essay distinguishes a minimum duty from a demand to eradicate every wrong.',
        ],
        1,
      ),
      round(
        'A little friction is inevitable. Why interrupt the system?',
        'c05',
        'When participation requires me to wrong another person, I must interrupt it.',
        [
          'Every inconvenience makes all lawbreaking justified.',
          'Keeping machinery running is always morally superior.',
        ],
        'He draws a threshold between ordinary friction and becoming an agent of injustice. Counter friction is principled interruption of that participation.',
        [
          'His condition is more specific than inconvenience or personal dislike.',
          "A system's efficiency cannot settle whether it is just.",
        ],
      ),
      round(
        'Come back when your neighbors agree with you.',
        'c06',
        'Doing right does not require waiting for a numerical majority.',
        [
          'My ballot literally outweighs all other ballots.',
          'The goal is to defeat neighbors regardless of truth.',
        ],
        'A majority of one is a moral paradox: principled rightness does not need permission from a crowd.',
        [
          'The paradox is not an arithmetic rule for elections.',
          'The argument concerns right action rather than victory or hostility.',
        ],
        2,
      ),
    ],
  },
  {
    id: 2,
    title: 'What the walls cannot hold',
    speaker: 'The voice of the state',
    role: 'A symbolic debate inside the jail',
    intro:
      "The door closes. What has the state actually won? The opponent here personifies coercion; it is an invented dramatic device, not a historical official's testimony.",
    rounds: [
      round(
        'You are in prison. Surely that proves you chose wrongly.',
        'c07',
        'Punishment by an unjust government does not establish moral guilt.',
        [
          'Every prisoner in every case must therefore be innocent.',
          'Being comfortable is the only test of doing right.',
        ],
        'His claim is conditional on unjust imprisonment. Accepting consequences for refusing complicity can preserve integrity.',
        [
          'The passage does not certify the innocence of every prisoner.',
          'His account distinguishes moral integrity from outward comfort.',
        ],
        2,
      ),
      round(
        'Your body is confined. Your resistance is finished.',
        'c08',
        'Walls can restrict movement without containing conscience or thought.',
        [
          'The door must secretly be unlocked.',
          "Thought is irrelevant unless it earns the state's approval.",
        ],
        'Thoreau smiles at an institution trying to imprison meditations. His physical confinement is real, but the state has not settled his moral judgment.',
        [
          'The passage does not claim a physical escape or an unlocked door.',
          'The value of conscience is not derived from official approval.',
        ],
      ),
      round(
        'We have the power to compel you. That makes our argument right.',
        'c09',
        'Superior physical strength does not supply superior reason or honesty.',
        [
          'No government can ever physically harm anyone.',
          'Force and moral authority mean the same thing.',
        ],
        "He names the state's physical advantage while denying that it confers intellectual or moral superiority.",
        [
          'He recognizes coercive power and its consequences; that is why he distinguishes it from truth.',
          'The passage explicitly separates those ideas.',
        ],
        1,
      ),
    ],
  },
  {
    id: 3,
    title: 'A state worth respecting',
    speaker: 'The dawn visitor',
    role: 'A fictional voice asking what comes next',
    intro:
      'Morning brings release, but release does not resolve the argument. Explain what principled resistance asks of a future government and of a neighbor.',
    rounds: [
      round(
        'So your practical demand is to eliminate every government immediately?',
        'c10',
        'The immediate demand is better government; the ultimate ideal has conditions.',
        [
          'The opening cancels every qualification later in the essay.',
          'No improvement is possible before all institutions disappear.',
        ],
        'He explicitly asks for better government now. His opening ideal of governing not at all depends on people being prepared.',
        [
          'A careful reading holds the opening and its practical clarification together.',
          'He makes a practical demand for improvement within the present.',
        ],
        1,
      ),
      round(
        'If you refuse the state, must you refuse every duty to your neighbors?',
        'c11',
        'Principled resistance can coexist with roads, education, and neighborly responsibility.',
        [
          'He rejects the highway tax along with every other payment.',
          'Being a good neighbor requires approving every action of the state.',
        ],
        'He says he pays the highway tax and contributes to education. The distinction is between moral community and unquestioning allegiance.',
        [
          'The source expressly says he has never declined paying the highway tax.',
          'He distinguishes neighborly duty from being an obedient subject.',
        ],
      ),
      round(
        'Where should a truly just state obtain its authority?',
        'c12',
        'From the consent of individuals whose independent power it respects.',
        [
          'From superior force alone.',
          'From an inherited arrangement that can never be reconsidered.',
        ],
        'The conclusion grounds authority in the governed and imagines further progress beyond existing democracy toward respect for the individual.',
        [
          'Physical dominance is not the sanction he requires for strict justice.',
          'He treats historical progress as incomplete and open to further improvement.',
        ],
        2,
      ),
    ],
  },
];
