/**
 * What a job description asks for: skills (with categories and proper spelling), the job title, years of
 * experience and degree. Company blurbs, values, benefits and interview steps are ignored.
 */

export type KeywordCategory = 'language' | 'frontend' | 'backend' | 'data' | 'cloud' | 'testing' | 'tools' | 'ai' | 'concept' | 'soft' | 'domain' | 'other';

export const CATEGORY_LABELS: Record<KeywordCategory, string> = {
  language: 'Languages', frontend: 'Frontend', backend: 'Backend', data: 'Data', cloud: 'Cloud & DevOps', testing: 'Testing',
  tools: 'Tools', ai: 'AI', concept: 'Core concepts', soft: 'Soft skills', domain: 'Domain', other: 'Other',
};

/** Spelling variants → one form, applied to both the job post and the resume before matching. */
const ALIASES: [RegExp, string][] = [
  [/\breact\s?\.?\s?js\b/g, 'react'], [/\bnext\s?\.?\s?js\b/g, 'nextjs'], [/\bnode\s?\.?\s?js\b/g, 'nodejs'],
  [/\bvue\s?\.?\s?js\b/g, 'vue'], [/\bangular\s?js\b/g, 'angular'], [/\bexpress\s?\.?\s?js\b/g, 'express'],
  [/\bnest\s?\.?\s?js\b/g, 'nestjs'], [/\bthree\s?\.?\s?js\b/g, 'threejs'], [/\bpixi\s?\.?\s?js\b/g, 'pixijs'], [/\bd3\s?\.?\s?js\b/g, 'd3'],
  [/\bpostgres(ql)?\b/g, 'postgresql'], [/\bk8s\b/g, 'kubernetes'], [/\bgolang\b/g, 'go lang'],
  [/\bci\s?\/\s?cd\b/g, 'cicd'], [/\bgen\s?ai\b/g, 'generative ai'], [/\bmicro-?\s?services\b/g, 'microservices'],
  [/\bfront[- ]?end\b/g, 'frontend'], [/\bback[- ]?end\b/g, 'backend'], [/\bfull[- ]?stack\b/g, 'fullstack'],
  [/\bjs\b/g, 'javascript'], [/\bts\b/g, 'typescript'], [/\brestful\b/g, 'rest'], [/\bllms?\b/g, 'llm'],
  [/\bhtml\s?5\b/g, 'html'], [/\bcss\s?3\b/g, 'css'], [/\bscss\b/g, 'sass'], [/\bes6\b/g, 'javascript'],
  [/\bunit[- ]test(s|ing)?\b/g, 'unit testing'], [/\be2e\b|\bend[- ]to[- ]end test(s|ing)?\b/g, 'e2e testing'],
  [/\bamazon web services\b/g, 'aws'], [/\bgoogle cloud( platform)?\b/g, 'gcp'], [/\bmachine[- ]learning\b/g, 'machine learning'],
  [/\bobject[- ]oriented( programming| design)?\b|\boops?\b/g, 'oop'],
  [/\bdata[- ]structures?\b/g, 'data structures'], [/\balgorithms?\b/g, 'algorithms'],
  [/\bdesign patterns?\b/g, 'design patterns'], [/\bclient\s?[/-]?\s?server\b/g, 'client-server'],
  [/\bdistributed (application|applications|systems?)\b/g, 'distributed systems'],
  [/\b(code )?version(ing)? control\b|\bcode versioning\b/g, 'version control'],
  [/\bbug[- ]tracking\b/g, 'bug tracking'], [/\bdebug(ging|gers?|ged)?\b/g, 'debugging'],
  [/\bides?\b/g, 'ide'], [/\bgames? development\b|\bgame developers?\b|\bgame dev\b/g, 'game development'],
  [/\bui development\b|\bui developers?\b|\buser interface development\b/g, 'ui development'], [/\banimations?\b/g, 'animations'],
  [/\bmentor(s|ed|ing|ship)?\b/g, 'mentoring'], [/\bcollaborat(e|ed|es|ing|ion|ive|ively)\b/g, 'collaboration'],
  [/\bcommunicat(e|ed|es|ing|ion|ions)\b/g, 'communication'], [/\bproblem[- ]solv(ing|er)\b/g, 'problem solving'],
  [/\bleader(ship)?\b|\bled (a|the) team\b/g, 'leadership'], [/\be[- ]?commerce\b/g, 'ecommerce'],
  [/\bperformance optimi[sz](ation|ing|ed)\b/g, 'performance optimization'], [/\bresponsive (web )?design\b/g, 'responsive design'],
  [/\bweb ?sockets?\b/g, 'websockets'], [/\bweb ?gl\b/g, 'webgl'],
  // British → American spelling, so "optimisation" matches "optimization".
  [/(optimi|organi|standardi|moderni|customi|visuali|prioriti|summari|utili)s(e|ed|es|ing|ation|ations)\b/g, '$1z$2'],
  [/\bbehaviour/g, 'behavior'], [/\bcolour/g, 'color'], [/\banalys(e|ed|es|ing)\b/g, 'analyz$1'],
];

export function normalize(text: string) {
  let value = ` ${text.toLowerCase().replace(/[’']/g, '')} `;
  for (const [pattern, replacement] of ALIASES) value = value.replace(pattern, replacement);
  return value.replace(/[^a-z0-9+#./\s-]/g, ' ').replace(/\s+/g, ' ');
}

type Term = { term: string; label: string; category: KeywordCategory };
const T = (category: KeywordCategory, list: string): Term[] => list.split('|').map((entry) => {
  const [term, label] = entry.split('=');
  return { term: term.trim(), label: (label ?? term).trim(), category };
});

/** Terms recruiters search for, with how they should be written on a resume. Multi-word terms first. */
export const TERMS: Term[] = [
  ...T('ai', 'generative ai=Generative AI|large language models=LLMs|prompt engineering=Prompt Engineering|machine learning=Machine Learning|deep learning=Deep Learning|computer vision=Computer Vision|natural language processing=NLP|vector databases=Vector Databases|llm=LLMs|rag=RAG|openai=OpenAI|langchain=LangChain|pytorch=PyTorch|tensorflow=TensorFlow'),
  ...T('concept', 'data structures=Data Structures|algorithms=Algorithms|system design=System Design|design patterns=Design Patterns|distributed systems=Distributed Systems|client-server=Client-Server Architecture|oop=Object-Oriented Programming|microservices=Microservices|event-driven=Event-Driven Architecture|micro frontends=Micro-frontends|design system=Design Systems|design systems=Design Systems|state management=State Management|server-side rendering=Server-Side Rendering|performance optimization=Performance Optimization|core web vitals=Core Web Vitals|web performance=Web Performance|responsive design=Responsive Design|accessibility=Accessibility|wcag=WCAG|seo=SEO|security=Web Security|scalability=Scalability|architecture=Software Architecture|rest api=REST APIs|rest apis=REST APIs|rest=REST APIs|version control=Version Control|debugging=Debugging|code review=Code Reviews|code reviews=Code Reviews|agile=Agile|scrum=Scrum|ui development=UI Development|animations=Animations|cross-browser=Cross-Browser Compatibility'),
  ...T('language', 'javascript=JavaScript|typescript=TypeScript|python=Python|java=Java|kotlin=Kotlin|swift=Swift|go lang=Go|rust=Rust|c++=C++|c#=C#|.net=.NET|php=PHP|ruby=Ruby|scala=Scala|html=HTML5|css=CSS3|sql=SQL|dart=Dart|lua=Lua'),
  ...T('frontend', 'react native=React Native|react=React|nextjs=Next.js|redux=Redux|zustand=Zustand|vue=Vue.js|angular=Angular|svelte=Svelte|jquery=jQuery|sass=Sass|tailwind css=Tailwind CSS|tailwind=Tailwind CSS|webpack=Webpack|vite=Vite|grunt=Grunt|gulp=Gulp|babel=Babel|storybook=Storybook|threejs=Three.js|pixijs=PixiJS|phaser=Phaser|webgl=WebGL|canvas=HTML Canvas|d3=D3.js|flutter=Flutter|unity=Unity|fdc3=FDC3|material ui=Material UI|figma=Figma'),
  ...T('backend', 'nodejs=Node.js|express=Express|nestjs=NestJS|django=Django|flask=Flask|fastapi=FastAPI|spring boot=Spring Boot|spring=Spring|rails=Ruby on Rails|graphql=GraphQL|grpc=gRPC|websockets=WebSockets|kafka=Kafka|rabbitmq=RabbitMQ|serverless=Serverless|oauth=OAuth'),
  ...T('data', 'postgresql=PostgreSQL|mysql=MySQL|mongodb=MongoDB|redis=Redis|elasticsearch=Elasticsearch|dynamodb=DynamoDB|firebase=Firebase|sqlite=SQLite|prisma=Prisma'),
  ...T('cloud', 'aws=AWS|azure=Azure|gcp=Google Cloud|docker=Docker|kubernetes=Kubernetes|terraform=Terraform|cicd=CI/CD|github actions=GitHub Actions|jenkins=Jenkins|linux=Linux|nginx=Nginx|vercel=Vercel|lambda=AWS Lambda|observability=Observability|monitoring=Monitoring'),
  ...T('testing', 'unit testing=Unit Testing|e2e testing=End-to-End Testing|test automation=Test Automation|jest=Jest|vitest=Vitest|cypress=Cypress|playwright=Playwright|puppeteer=Puppeteer|selenium=Selenium|jmeter=JMeter|react testing library=React Testing Library|tdd=TDD'),
  ...T('tools', 'git=Git|github=GitHub|gitlab=GitLab|bitbucket=Bitbucket|svn=SVN|cvs=CVS|jira=Jira|confluence=Confluence|bug tracking=Bug Tracking|ide=IDEs|vs code=VS Code|chrome devtools=Chrome DevTools|postman=Postman|npm=npm'),
  ...T('soft', 'communication=Communication|collaboration=Collaboration|mentoring=Mentoring|leadership=Leadership|problem solving=Problem Solving|ownership=Ownership|stakeholder management=Stakeholder Management|cross-functional=Cross-functional Collaboration|teamwork=Teamwork|time management=Time Management'),
  ...T('domain', 'game development=Game Development|igaming=iGaming|gaming=Gaming|payments=Payments|fintech=Fintech|trading=Trading|banking=Banking|ecommerce=E-commerce|healthcare=Healthcare|edtech=EdTech|saas=SaaS|blockchain=Blockchain|crypto=Crypto|insurance=Insurance|logistics=Logistics|adtech=AdTech|mobile=Mobile|ios=iOS|android=Android|analytics=Analytics'),
];
const TERM_BY_KEY = new Map(TERMS.map((term) => [term.term, term]));
const sortedTerms = [...TERMS].sort((a, b) => b.term.length - a.term.length);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const termPattern = (term: string, flags = '') => new RegExp(`(^|[\\s(/,;:])${escapeRegex(term)}(?=$|[\\s)/,.:;!?])`, flags);

/** "game development" → "Game Development" (known spelling, else title case). */
export const keywordLabel = (term: string) => TERM_BY_KEY.get(term)?.label ?? term.replace(/\b\w/g, (c) => c.toUpperCase());
export const keywordCategory = (term: string): KeywordCategory => TERM_BY_KEY.get(term)?.category ?? 'other';

// ---------- reading the job post ----------

const SKIP_HEADING = /^(about (the )?(company|us|lnw|our team)|who we are|our (values|culture|story|mission|benefits)|values|benefits|perks|what we offer|why (join|work)|equal (opportunity|employment)|eeo|diversity|mode of interview|interview( process| rounds)?|hiring process|how to apply|compensation|salary|disclaimer|company overview)\b/i;
const KEEP_HEADING = /(position|role|job) (summary|description|overview)|responsibilit|duties|requirement|qualification|skills|experience|education|what you|you will|you'll|must[- ]have|nice[- ]to[- ]have|preferred|bonus|about (the )?role|about you|tech stack|who you are|key (skills|areas)/i;
const PREFERRED_HEADING = /prefer|nice[- ]to|bonus|plus|good to have|desirable|optional/i;
const REQUIREMENT_LINE = /\b(required|requirement|must|strong|proficien|experience (in|with)|hands[- ]on|understanding of|knowledge of|familiar|expert|solid|deep|ability to)\b/i;
const TITLE_LINE = /^(?:(senior|sr\.?|lead|staff|principal|junior|jr\.?|mid[- ]level|associate|head of)\s+)?[a-z0-9 /&+.,()-]{0,45}\b(engineer|developer|architect|programmer|designer|scientist|analyst|consultant|specialist|lead)\b[a-z0-9 ()/,-]{0,25}$/i;

const isHeading = (line: string) => line.length <= 60 && !/[.!?]$/.test(line) && line.split(/\s+/).length <= 7;

export type JobInfo = {
  title: string | null;
  minYears: number | null;
  degree: boolean;
  /** Lines that describe the role (company blurb, values, benefits and interview steps removed). */
  relevant: { text: string; weight: number }[];
};

export function readJob(jobDescription: string): JobInfo {
  const lines = jobDescription.split(/\r?\n/).map((line) => line.replace(/^[\s•●▪◦\-–*•]+/, '').trim()).filter(Boolean);
  let skipping = false;
  let preferred = false;
  let title: string | null = null;
  const relevant: JobInfo['relevant'] = [];
  for (const line of lines) {
    const heading = isHeading(line) ? line.replace(/:$/, '') : null;
    if (heading) {
      if (!title && TITLE_LINE.test(heading) && !/^(position|job|role)\b/i.test(heading)) { title = heading; skipping = false; continue; }
      if (SKIP_HEADING.test(heading)) { skipping = true; continue; }
      if (KEEP_HEADING.test(heading)) { skipping = false; preferred = PREFERRED_HEADING.test(heading); continue; }
    }
    if (skipping) continue;
    const weight = preferred ? 1 : REQUIREMENT_LINE.test(line) ? 3 : 2;
    relevant.push({ text: line, weight });
  }
  const all = jobDescription.replace(/\s+/g, ' ');
  const years = all.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years|yrs)/i);
  const degree = /\b(bachelor'?s?|b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|master'?s?|degree in|computer science|computer engineering)\b/i.test(all);
  return { title, minYears: years ? Number(years[1]) : null, degree, relevant: relevant.length ? relevant : [{ text: jobDescription, weight: 2 }] };
}

const GENERIC = new Set(`about above across after again against also although among another apply around based because become before being below best better
between beyond both bring build building business candidate candidates career company companies content create created creating culture customer
customers deliver delivering delivery description design desired develop developing development different digital drive each early employee employees
engineer engineers engineering ensure environment every excellent experience experiences expert extraordinary features field global great growth help
highly ideal impact including industry innovative innovation interview join knowledge leading learn level looking maintain make management member
members mission modern opportunity opportunities other others part people platform platforms player players position preferred process processes
product products provide quality range related required requirements responsibilities responsible role service services should skills software solutions
strong success support systems team teams technical technologies technology their them these things through timely tools understanding using value values
various well what where which while within without work working world would years their there those thrilling unique wherever
language languages framework frameworks library libraries understanding familiarity proficient advanced basic`.split(/\s+/));

export type JobKeyword = { term: string; label: string; category: KeywordCategory; weight: number };

/** The skills and terms a job post asks for, most important first (max 30). */
export function jobKeywords(jobDescription: string, job: JobInfo = readJob(jobDescription)): JobKeyword[] {
  const weights = new Map<string, number>();
  const add = (term: string, weight: number) => weights.set(term, (weights.get(term) ?? 0) + weight);
  const leftovers: { text: string; weight: number }[] = [];
  for (const line of job.relevant) {
    let text = normalize(line.text);
    for (const { term } of sortedTerms) {
      const pattern = termPattern(term, 'g');
      const hits = text.match(pattern)?.length ?? 0;
      if (hits) { add(term, line.weight + hits); text = text.replace(pattern, ' '); }
    }
    leftovers.push({ text, weight: line.weight });
  }
  // Repeated words that aren't in the list (domain words like "trading", "slots"…), only if they recur.
  const counts = new Map<string, number>();
  for (const { text } of leftovers) {
    for (const word of text.split(/\s+/)) {
      const stem = word.replace(/[.,]+$/, '').replace(/s$/, '');
      if (stem.length < 5 || GENERIC.has(stem) || GENERIC.has(`${stem}s`) || /\d/.test(stem)) continue;
      counts.set(stem, (counts.get(stem) ?? 0) + 1);
    }
  }
  for (const [stem, count] of counts) if (count >= 3) add(stem, count);

  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 30)
    .map(([term, weight]) => ({ term, label: keywordLabel(term), category: keywordCategory(term), weight }));
}

export function hasTerm(normalizedText: string, term: string) {
  if (termPattern(term).test(normalizedText)) return true;
  // Leftover stems ("slot") also match their plural.
  return !TERM_BY_KEY.has(term) && termPattern(`${term}s`).test(normalizedText);
}

/** Job title words present in the headline (e.g. 3 of 4 for "Senior Frontend Software Engineer"). */
export function titleMatch(title: string, headline: string) {
  const words = normalize(title).split(' ').filter((word) => word.length > 2 && !['and', 'the', 'for'].includes(word));
  const have = normalize(headline);
  const found = words.filter((word) => termPattern(word).test(have));
  return { found: found.length, total: words.length, ratio: words.length ? found.length / words.length : 1 };
}
