import source from './source.json' with { type: 'json' };

export type Chapter = 4 | 5 | 6 | 7 | 8;
export type Ref = `${Chapter}.${number}`;
export type Point = [number, number];
export interface Line {
  speaker: string;
  text: string;
  refs: Ref[];
  exact?: boolean;
}
export interface Task {
  title: string;
  instruction: string;
  choices: string[];
  answer: number;
  why: string;
}
export interface Stage {
  title: string;
  action: string;
  at: Point;
  object: 'lantern' | 'ship' | 'person' | 'desk' | 'bread' | 'timber' | 'cabin' | 'gate';
  lines: Line[];
  task?: Task[];
  herd?: boolean;
}
export interface Mission {
  id: Chapter;
  title: string;
  subtitle: string;
  genre: string;
  summary: string;
  color: string;
  spawn: Point;
  yaw: number;
  stages: Stage[];
}
const voice = (text: string, ...refs: Ref[]): Line => ({
  speaker: 'Frederick Douglass · retold',
  text,
  refs,
});
const reported = (speaker: string, text: string, ...refs: Ref[]): Line => ({
  speaker: `${speaker} · reported speech`,
  text,
  refs,
  exact: true,
});
const task = (
  title: string,
  instruction: string,
  choices: string[],
  answer: number,
  why: string,
): Task => ({ title, instruction, choices, answer, why });

export const missions: Mission[] = [
  {
    id: 4,
    title: 'What the creek remembers',
    subtitle: 'A voice against silence',
    genre: 'Explore & investigate',
    summary: 'Follow the creek. Listen to the testimony. Find the truth that power tried to bury.',
    color: '#9fcac0',
    spawn: [0, 14],
    yaw: 0,
    stages: [
      {
        title: 'Reach the overseer’s path',
        action: 'Listen',
        at: [0, 6],
        object: 'gate',
        lines: [
          voice(
            'Austin Gore replaced Hopkins as overseer. Under him, an accusation became punishment. Enslaved people were allowed no defense.',
            '4.1',
            '4.2',
          ),
          voice(
            'His reputation for control depended on fear. What the plantation called a good overseer, I describe as cruelty.',
            '4.2',
            '4.3',
          ),
        ],
      },
      {
        title: 'Follow the water to the creek bank',
        action: 'Hear Demby’s story',
        at: [-8, -3],
        object: 'lantern',
        lines: [
          voice(
            'Demby ran into this creek to escape Gore’s whipping. Gore called him out three times, then killed him when he would not return.',
            '4.4',
          ),
          voice(
            'Gore defended the killing as necessary to keep control. Colonel Lloyd accepted his explanation and kept him as overseer.',
            '4.5',
          ),
        ],
      },
      {
        title: 'Find the clearing beyond the bridge',
        action: 'Follow the testimony',
        at: [5, -11],
        object: 'lantern',
        lines: [
          voice(
            'The enslaved witnesses could not bring a suit or testify against Gore. The murder never received a judicial investigation.',
            '4.5',
          ),
          voice(
            'I describe other killings too: by Thomas Lanman, Mrs. Hicks, and Beal Bondly. The pattern is violence protected by power.',
            '4.6',
            '4.7',
            '4.9',
            '4.10',
          ),
        ],
        task: [
          task(
            'Connect the evidence',
            'Why did Gore remain in power?',
            [
              'Demby had escaped to Baltimore.',
              'The enslaved witnesses had no legal voice, and Lloyd accepted Gore’s defense.',
              'Hopkins returned and investigated him.',
            ],
            1,
            'The same system that enabled Gore’s violence also shielded him from accountability.',
          ),
        ],
      },
      {
        title: 'Carry the testimony to the end of the path',
        action: 'Remember',
        at: [-1, -20],
        object: 'gate',
        lines: [
          voice(
            'Mrs. Hicks’s arrest warrant was never served. Bondly’s killing of an elderly man gathering food was hushed up.',
            '4.7',
            '4.9',
            '4.10',
          ),
          voice(
            'These are not isolated acts of cruelty in my account. I am exposing a community and courts that failed to protect Black lives.',
            '4.5',
            '4.6',
            '4.7',
            '4.10',
          ),
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'Eyes on the horizon',
    subtitle: 'The first great turning point',
    genre: 'Voyage & shepherd',
    summary:
      'Cross the deck, watch the coast change, then guide the sheep through Baltimore’s wharf.',
    color: '#f0c78b',
    spawn: [0, 15],
    yaw: 0,
    stages: [
      {
        title: 'Look back from the stern',
        action: 'Look back',
        at: [0, 11],
        object: 'ship',
        lines: [
          voice(
            'As a child I suffered hunger and cold. I slept partly inside a corn bag. Then I learned I would be sent to Baltimore.',
            '5.2',
            '5.3',
            '5.4',
          ),
          voice(
            'Lucretia promised me trousers if I washed well. I left with hope: Baltimore might offer something the plantation never had.',
            '5.5',
            '5.6',
          ),
        ],
      },
      {
        title: 'Walk to the bow and face the horizon',
        action: 'Watch the coast',
        at: [0, -8],
        object: 'ship',
        lines: [
          voice(
            'We sailed from Miles River on Saturday, stopped briefly at Annapolis, and reached Baltimore on Sunday morning.',
            '5.7',
            '5.8',
            '5.9',
          ),
          voice(
            'After one last look back, I spent the day looking ahead. Now we have landed at Smith’s Wharf. Help guide the sheep ashore.',
            '5.7',
            '5.9',
          ),
        ],
      },
      {
        title: 'Guide all three sheep to the striped pen',
        action: 'Finish the delivery',
        at: [12, -15],
        object: 'gate',
        herd: true,
        lines: [
          voice(
            'I helped drive the sheep to Mr. Curtis’s slaughterhouse. Then Rich, a hand from the sloop, led me to my new home.',
            '5.9',
          ),
          voice(
            'I would live with Hugh and Sophia Auld and care for their little son, Thomas. Sophia’s kindness filled me with hope.',
            '5.9',
            '5.10',
          ),
        ],
      },
      {
        title: 'Follow Rich to the Aulds’ doorway',
        action: 'Step into Baltimore',
        at: [4, -25],
        object: 'person',
        lines: [
          voice(
            'Looking back, I call the move to Baltimore the gateway to my later opportunities. It was a turning point, not freedom itself.',
            '5.11',
          ),
          voice(
            'Even in slavery’s darkest hours, I kept a conviction that it would not hold me forever. I understood that hope through faith.',
            '5.12',
          ),
        ],
      },
    ],
  },
  {
    id: 6,
    title: 'The door in the mind',
    subtitle: 'A lesson they could not undo',
    genre: 'First-person discovery',
    summary:
      'Step inside the Aulds’ home. Learn your first letters—and discover why they frighten Hugh.',
    color: '#dfb695',
    spawn: [0, 12],
    yaw: 0,
    stages: [
      {
        title: 'Meet Sophia by the window',
        action: 'Talk to Sophia',
        at: [-5, 5],
        object: 'person',
        lines: [
          voice(
            'Sophia Auld had worked as a weaver. She had never controlled an enslaved person before me, and at first treated me with kindness.',
            '6.1',
          ),
          voice(
            'She began teaching me the alphabet, then short words. This small beginning would change the direction of my life.',
            '6.3',
          ),
        ],
      },
      {
        title: 'Try the letter table',
        action: 'Practice letters',
        at: [4, 0],
        object: 'desk',
        lines: [
          voice(
            'Learning began with A, B, C. This practice is a game illustration of that first step—not a recorded classroom exercise.',
            '6.3',
          ),
        ],
        task: [
          task(
            'The letter table',
            'Complete the sequence: A → B → ?',
            ['D', 'C', 'F'],
            1,
            'First came the alphabet. Sophia then helped him spell short words.',
          ),
          task(
            'The letter table',
            'Put the letters in order.',
            ['C · A · B', 'B · C · A', 'A · B · C'],
            2,
            'A beginning he could build on, even after formal lessons stopped.',
          ),
        ],
      },
      {
        title: 'Hear Hugh at the doorway',
        action: 'Listen to Hugh’s objection',
        at: [0, -7],
        object: 'person',
        lines: [
          voice(
            'Hugh stopped the lessons. He argued that reading would make me unfit for slavery. His opposition taught me why education mattered.',
            '6.3',
          ),
          reported('Hugh Auld', 'It would forever unfit him to be a slave.', '6.3'),
          voice(
            'What he feared, I wanted. I now saw learning as a path toward freedom and resolved to continue without a regular teacher.',
            '6.3',
          ),
        ],
        task: [
          task(
            'Turn the argument around',
            'What did Hugh accidentally teach Douglass?',
            [
              'Ignorance helped sustain slavery; knowledge could challenge it.',
              'Literacy guaranteed immediate legal freedom.',
              'Sophia could only teach weaving.',
            ],
            0,
            'Hugh intended to stop him. Instead, his reasoning strengthened Douglass’s determination.',
          ),
        ],
      },
      {
        title: 'Step out to Philpot Street',
        action: 'Look beyond this house',
        at: [10, -18],
        object: 'gate',
        lines: [
          voice(
            'City conditions were often better than plantation life, partly because neighbors could see cruelty. But better did not mean free or safe.',
            '6.4',
          ),
          voice(
            'Henrietta and Mary, enslaved by Thomas Hamilton, suffered terrible abuse and hunger. Their treatment exposes the limits of that difference.',
            '6.4',
          ),
        ],
      },
    ],
  },
  {
    id: 7,
    title: 'The city is my classroom',
    subtitle: 'Turn every errand into a lesson',
    genre: 'Street run & shipyard puzzle',
    summary:
      'Carry bread through the streets, trade for a lesson, and read the shipwrights’ marks.',
    color: '#a8c6e3',
    spawn: [0, 15],
    yaw: 0,
    stages: [
      {
        title: 'Take bread for your errand',
        action: 'Take the bread',
        at: [-3, 9],
        object: 'bread',
        lines: [
          voice(
            'Sophia stopped teaching me and began opposing my reading. But I had already started. I found other teachers among the boys in the street.',
            '7.1',
            '7.2',
            '7.3',
            '7.4',
          ),
          voice(
            'I hurried through errands to make time for lessons. I gave hungry boys bread, and they shared their knowledge with me.',
            '7.4',
          ),
        ],
      },
      {
        title: 'Bring the bread to your street teacher',
        action: 'Trade bread for a lesson',
        at: [-8, -5],
        object: 'person',
        lines: [
          voice(
            'I do not name those boys in my book, because helping me could put them at risk. Their kindness made the street a classroom.',
            '7.4',
          ),
          voice(
            'The Columbian Orator gave language to my thoughts. A dialogue challenged slavery; Sheridan’s speech defended human rights.',
            '7.5',
            '7.6',
          ),
        ],
        task: [
          task(
            'Find the power in the words',
            'What changed when Douglass read these arguments?',
            [
              'He could express and defend thoughts he had struggled to put into words.',
              'He immediately became legally free.',
              'He gave up trying to learn.',
            ],
            0,
            'Reading strengthened his voice, even while making his lack of freedom more painful.',
          ),
        ],
      },
      {
        title: 'Reach the wharf beside the shipyard',
        action: 'Hear the advice',
        at: [8, -12],
        object: 'person',
        lines: [
          voice(
            'Reading sharpened both my understanding and my anguish. A newspaper helped me understand that abolitionists sought to end slavery.',
            '7.6',
            '7.7',
          ),
          voice(
            'Two Irishmen advised me to flee north. I remembered their advice but feared a trap. I would wait—and first learn to write.',
            '7.7',
          ),
          reported('An Irish dockworker', 'Are ye a slave for life?', '7.7'),
        ],
      },
      {
        title: 'Decode the shipwrights’ timber',
        action: 'Try the chalk marks',
        at: [0, -24],
        object: 'timber',
        lines: [
          voice(
            'At Durgin and Bailey’s shipyard, letters on timber showed where each piece belonged. I copied them, then practiced with chalk.',
            '7.8',
          ),
          reported('A street boy', 'I don’t believe you. Let me see you try it.', '7.8'),
          voice(
            'I also copied Webster’s spelling book and spaces in young Thomas’s copybooks. Learning to write took years of persistence.',
            '7.8',
          ),
        ],
        task: [
          task(
            'Shipwright’s marks',
            'Send a timber marked L to its side of the ship.',
            ['Starboard · right', 'Larboard · left', 'Forward · front'],
            1,
            'L means larboard, the left side. These are the markings Douglass describes.',
          ),
          task(
            'Shipwright’s marks',
            'Which mark belongs on the starboard side, forward?',
            ['L. A.', 'S. A.', 'S. F.'],
            2,
            'S = starboard; F = forward.',
          ),
          task(
            'Shipwright’s marks',
            'A timber goes to larboard, aft. Choose its mark.',
            ['L. A.', 'L. F.', 'S. F.'],
            0,
            'L = larboard; A = aft. Ordinary work became an opportunity to learn.',
          ),
        ],
      },
    ],
  },
  {
    id: 8,
    title: 'No one is property',
    subtitle: 'A return he did not choose',
    genre: 'Journey & memory reconstruction',
    summary:
      'Return for the estate division, follow the broken family ties, and watch the boats heading north.',
    color: '#c9b6df',
    spawn: [0, 15],
    yaw: 0,
    stages: [
      {
        title: 'Enter the estate yard',
        action: 'Remember the return',
        at: [0, 6],
        object: 'gate',
        lines: [
          voice(
            'Captain Anthony died without a will. I was called back from Baltimore so his estate could be valued and divided between Andrew and Lucretia.',
            '8.1',
          ),
          voice(
            'People were ranked with livestock and examined as property. Families had no voice in decisions that could separate them forever.',
            '8.2',
            '8.3',
          ),
        ],
      },
      {
        title: 'Find the path beyond the division',
        action: 'Follow what happened',
        at: [-7, -3],
        object: 'desk',
        lines: [
          voice(
            'I feared Andrew, who had brutally attacked my brother. I was assigned to Lucretia instead and returned to Hugh’s family in Baltimore.',
            '8.4',
            '8.5',
          ),
          voice(
            'Lucretia and Andrew later died. The enslaved people passed to strangers. None of them gained freedom from these deaths.',
            '8.6',
          ),
        ],
        task: [
          task(
            'Rebuild the sequence',
            'What forced Douglass’s return for valuation?',
            [
              'Captain Anthony died without a will.',
              'Hugh agreed to free him.',
              'Douglass had already escaped.',
            ],
            0,
            'Anthony’s death led to valuation and division of the estate.',
          ),
          task(
            'Rebuild the sequence',
            'What followed Douglass’s assignment to Lucretia?',
            [
              'A move to Philadelphia.',
              'A return to Hugh’s family in Baltimore.',
              'His immediate emancipation.',
            ],
            1,
            'His return to Baltimore was a relief, but he remained enslaved.',
          ),
        ],
      },
      {
        title: 'Reach the cabin in the woods',
        action: 'Remember his grandmother',
        at: [7, -13],
        object: 'cabin',
        lines: [
          voice(
            'In this remembered image, my grandmother is alone in a hut. After a lifetime of service, her enslavers left her to support herself in old age.',
            '8.6',
            '8.8',
          ),
          voice(
            'I imagine her loneliness and condemn their ingratitude. This passage is a reflection—not an account of my visiting her deathbed.',
            '8.6',
            '8.8',
          ),
        ],
      },
      {
        title: 'Look north from the waterfront',
        action: 'Watch the steamboats',
        at: [0, -25],
        object: 'ship',
        lines: [
          voice(
            'After a quarrel with Hugh, Thomas took me to St. Michael’s. Leaving the Baltimore boys who had taught me was especially painful.',
            '8.9',
          ),
          voice(
            'On the voyage, I watched Philadelphia steamboats turn northeast up the bay. My resolve to escape returned. I would wait for an opportunity.',
            '8.10',
            '8.11',
          ),
        ],
        task: [
          task(
            'Keep the direction',
            'At North Point, which way did Philadelphia’s steamboats go?',
            ['Down the bay to the south.', 'Up the bay, northeast.', 'Back toward the plantation.'],
            1,
            'The chapter ends with renewed determination—not an escape.',
          ),
        ],
      },
    ],
  },
];

export interface Question {
  id: string;
  chapter: Chapter;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  refs: Ref[];
}
const q = (
  chapter: Chapter,
  n: number,
  prompt: string,
  choices: string[],
  answer: number,
  explanation: string,
  ...refs: Ref[]
): Question => ({ id: `dn-${chapter}-${n}`, chapter, prompt, choices, answer, explanation, refs });
export const questions: Question[] = [
  q(
    4,
    1,
    'What does Douglass emphasize about Gore’s rule?',
    [
      'Accused people could defend themselves.',
      'An accusation led directly to punishment.',
      'He avoided harsh punishment.',
      'He opposed Colonel Lloyd.',
    ],
    1,
    'Gore allowed no explanation or defense from an enslaved person.',
    '4.2',
  ),
  q(
    4,
    2,
    'Why did Demby enter the creek?',
    [
      'To escape a whipping.',
      'To travel to Baltimore.',
      'To meet Sophia Auld.',
      'To collect timber.',
    ],
    0,
    'Demby fled Gore’s whipping and stood in the creek.',
    '4.4',
  ),
  q(
    4,
    3,
    'How did Gore justify killing Demby?',
    [
      'He denied doing it.',
      'He blamed Hopkins.',
      'He said it was necessary to maintain control.',
      'He said Lloyd had freed Demby.',
    ],
    2,
    'He claimed disobedience would spread if Demby lived.',
    '4.5',
  ),
  q(
    4,
    4,
    'Why could the enslaved witnesses not hold Gore accountable?',
    [
      'They were all in Baltimore.',
      'They had forgotten the event.',
      'They agreed with Gore.',
      'They could neither bring suit nor testify against him.',
    ],
    3,
    'Their exclusion from legal action protected Gore.',
    '4.5',
  ),
  q(
    4,
    5,
    'What happened to Gore after the killing?',
    [
      'He was removed from the plantation.',
      'He remained overseer without judicial investigation.',
      'He was replaced by Hopkins.',
      'He was sent to Philadelphia.',
    ],
    1,
    'Lloyd accepted his defense; no judicial investigation followed.',
    '4.5',
  ),
  q(
    4,
    6,
    'Why include the other killings in Chapter IV?',
    [
      'To show a broader pattern of violence going unpunished.',
      'To show that city life was always safe.',
      'To explain how Douglass learned to read.',
      'To celebrate the overseers.',
    ],
    0,
    'Lanman, Mrs. Hicks, and Bondly reinforce the argument about systemic impunity.',
    '4.6',
    '4.7',
    '4.9',
    '4.10',
  ),
  q(
    5,
    1,
    'What hardships does Douglass emphasize from his early childhood?',
    [
      'Excessive schoolwork.',
      'Hunger and especially cold.',
      'Shipbuilding injuries.',
      'A lack of errands.',
    ],
    1,
    'He lacked adequate clothing and a bed and used a corn bag against the cold.',
    '5.2',
    '5.3',
  ),
  q(
    5,
    2,
    'How did Douglass feel about leaving for Baltimore?',
    [
      'He refused to go.',
      'He knew he had been freed.',
      'He felt hopeful and joyful.',
      'He wanted to remain at the plantation.',
    ],
    2,
    'He looked ahead with hope that life could be better.',
    '5.4',
    '5.6',
    '5.7',
  ),
  q(
    5,
    3,
    'Which route matches his first journey to Baltimore?',
    [
      'Miles River → Annapolis → Baltimore.',
      'Baltimore → Philadelphia → Miles River.',
      'Annapolis → St. Michael’s → Philadelphia.',
      'Miles River → Philadelphia → Annapolis.',
    ],
    0,
    'He sailed Saturday, briefly stopped at Annapolis, and arrived Sunday morning.',
    '5.7',
    '5.8',
    '5.9',
  ),
  q(
    5,
    4,
    'Who brought him from the sloop to his new home?',
    ['Austin Gore.', 'Captain Anthony.', 'Young Thomas.', 'Rich, one of the sloop’s hands.'],
    3,
    'After helping drive the sheep, he was conducted to the Aulds’ home by Rich.',
    '5.9',
  ),
  q(
    5,
    5,
    'What was his duty in Hugh and Sophia Auld’s home?',
    [
      'To oversee a plantation.',
      'To care for their young son Thomas.',
      'To captain their ship.',
      'To work as a weaver.',
    ],
    1,
    'He was given to the household to care for little Thomas.',
    '5.10',
  ),
  q(
    5,
    6,
    'Why does the older Douglass see Baltimore as a turning point?',
    [
      'The move opened a gateway to later opportunities.',
      'He became free the moment he arrived.',
      'He never faced hardship again.',
      'His entire family moved there.',
    ],
    0,
    'He connects the move with the foundation of his later prosperity.',
    '5.11',
    '5.12',
  ),
  q(
    6,
    1,
    'How did Sophia initially treat Douglass?',
    [
      'With the same hostility she showed later.',
      'She refused to look at him.',
      'With unusual kindness and respect.',
      'She sent him back immediately.',
    ],
    2,
    'Her early kindness astonished him; she had not previously controlled an enslaved person.',
    '6.1',
  ),
  q(
    6,
    2,
    'What did Sophia begin teaching him?',
    [
      'The alphabet and short words.',
      'Ship navigation.',
      'Estate accounting.',
      'Plantation management.',
    ],
    0,
    'She began with A, B, C, then words of three or four letters.',
    '6.3',
  ),
  q(
    6,
    3,
    'Why did Hugh stop the lessons?',
    [
      'He wanted a different teacher.',
      'He feared literacy would make Douglass unfit for slavery.',
      'He could not find paper.',
      'He planned to free Douglass.',
    ],
    1,
    'Hugh connected knowledge with discontent and resistance to enslavement.',
    '6.3',
  ),
  q(
    6,
    4,
    'What did Douglass learn from Hugh’s objection?',
    [
      'Education was useless.',
      'He should abandon the alphabet.',
      'He had already escaped.',
      'Knowledge could be a path toward freedom.',
    ],
    3,
    'The intended discouragement strengthened his desire to learn.',
    '6.3',
  ),
  q(
    6,
    5,
    'What happens to Sophia under the influence of slavery?',
    [
      'She becomes a shipbuilder.',
      'Her initial kindness turns toward cruelty.',
      'She immediately frees Douglass.',
      'She returns to the plantation.',
    ],
    1,
    'Douglass presents unchecked power as corrupting her character.',
    '6.1',
    '6.2',
  ),
  q(
    6,
    6,
    'What do Henrietta and Mary’s experiences show?',
    [
      'City slavery could still involve terrible cruelty.',
      'Everyone in Baltimore was free.',
      'City neighbors always prevented abuse.',
      'The Aulds were their teachers.',
    ],
    0,
    'They are the painful exception to his description of generally better city conditions.',
    '6.4',
  ),
  q(
    7,
    1,
    'How did Douglass gain lessons during errands?',
    [
      'By attending a public school.',
      'By asking Gore.',
      'By trading bread with boys in the street.',
      'By becoming a ship’s captain.',
    ],
    2,
    'He hurried through errands and exchanged bread for reading instruction.',
    '7.4',
  ),
  q(
    7,
    2,
    'Why does he withhold the boys’ names?',
    [
      'He had forgotten all of them.',
      'He wanted to protect them from consequences.',
      'They asked him to stop reading.',
      'They were fictional.',
    ],
    1,
    'Teaching an enslaved person could expose them to blame or danger.',
    '7.4',
  ),
  q(
    7,
    3,
    'How did The Columbian Orator help him?',
    [
      'It gave him language to argue against slavery.',
      'It granted him a legal pass.',
      'It taught him how to steer a ship.',
      'It convinced him slavery was right.',
    ],
    0,
    'The dialogue and Sheridan’s speech helped him express and defend his own thoughts.',
    '7.5',
    '7.6',
  ),
  q(
    7,
    4,
    'Why did literacy bring pain as well as power?',
    [
      'He lost the ability to speak.',
      'He forgot his family.',
      'It prevented all further learning.',
      'He understood his oppression more clearly without an immediate way out.',
    ],
    3,
    'Knowledge deepened his anguish alongside his desire for freedom.',
    '7.6',
  ),
  q(
    7,
    5,
    'How did he respond to the Irishmen’s advice to flee?',
    [
      'He fled with them at once.',
      'He remembered it but feared a trap and waited.',
      'He reported them to Gore.',
      'He gave up the idea forever.',
    ],
    1,
    'He resolved to escape later and first wanted to learn to write.',
    '7.7',
  ),
  q(
    7,
    6,
    'What turned the shipyard into a writing lesson?',
    [
      'Marks on timber showed letters for parts of the ship.',
      'The carpenters opened a formal school.',
      'Gore gave him a copybook.',
      'He wrote the newspaper there.',
    ],
    0,
    'He copied timber markings, practiced with chalk, and later copied books and Thomas’s writing.',
    '7.8',
  ),
  q(
    8,
    1,
    'Why was Douglass called back for valuation?',
    [
      'He had become an overseer.',
      'He had completed his education.',
      'Captain Anthony died without a will.',
      'He volunteered to sell livestock.',
    ],
    2,
    'Anthony’s estate was to be valued and divided between Andrew and Lucretia.',
    '8.1',
  ),
  q(
    8,
    2,
    'What does ranking people with livestock expose?',
    [
      'The prosperity of free labor.',
      'The dehumanization of treating people as property.',
      'Douglass’s interest in farming.',
      'The legal freedom of all children.',
    ],
    1,
    'People had no voice over the division that could tear families apart.',
    '8.2',
    '8.3',
  ),
  q(
    8,
    3,
    'What happened when Douglass was assigned to Lucretia?',
    [
      'He returned to Hugh’s family in Baltimore.',
      'He was immediately freed.',
      'He went north with the Irishmen.',
      'He became Andrew’s overseer.',
    ],
    0,
    'He returned with relief, but remained enslaved.',
    '8.5',
  ),
  q(
    8,
    4,
    'What does the account of his grandmother condemn?',
    [
      'Her decision to leave Baltimore.',
      'Her refusal to learn letters.',
      'Her lack of service.',
      'Abandoning her after a lifetime of service and separating her family.',
    ],
    3,
    'Her enslavers left her alone in a hut when she grew old.',
    '8.6',
    '8.8',
  ),
  q(
    8,
    5,
    'Why was he moved from Hugh’s household to St. Michael’s?',
    [
      'Sophia arranged his freedom.',
      'Thomas used the move to punish Hugh after a quarrel.',
      'He had asked to stop learning.',
      'He had joined a steamboat crew.',
    ],
    1,
    'Thomas took him away after a misunderstanding with his brother Hugh.',
    '8.9',
  ),
  q(
    8,
    6,
    'How does Chapter VIII end?',
    [
      'With renewed resolve to escape when an opportunity comes.',
      'With his successful arrival in freedom.',
      'With his appointment as a teacher.',
      'With all his relatives freed.',
    ],
    0,
    'He observed Philadelphia-bound boats going northeast and renewed his determination.',
    '8.10',
    '8.11',
  ),
];

export const passage = (ref: Ref) =>
  source.chapters.flatMap((c) => c.paragraphs).find((p) => p.ref === ref)?.text ?? '';
export { source };
export function chapterQuestions(chapter: Chapter, random = Math.random): Question[] {
  const pool = questions.filter((q) => q.chapter === chapter);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 5).map((question) => {
    const choices = question.choices.map((text, i) => ({ text, correct: i === question.answer }));
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      ...question,
      choices: choices.map((c) => c.text),
      answer: choices.findIndex((c) => c.correct),
    };
  });
}
