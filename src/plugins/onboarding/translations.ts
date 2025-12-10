export type LanguageCode = 'en' | 'es' | 'pt' | 'fr';

export interface Messages {
  GREETING: string;
  LANGUAGE: string;
  LOCATION: string;
  ROLES: string;
  INTERESTS: string;
  GOALS: string;
  EVENTS: string;
  SOCIALS: string;
  TELEGRAM: string;
  GENDER: string;
  NOTIFICATIONS: string;
  COMPLETION: string;
  SUMMARY_TITLE: string;
  SUMMARY_NAME: string;
  SUMMARY_LOCATION: string;
  SUMMARY_ROLES: string;
  SUMMARY_INTERESTS: string;
  SUMMARY_GOALS: string;
  SUMMARY_EVENTS: string;
  SUMMARY_SOCIALS: string;
  SUMMARY_TELEGRAM: string;
  SUMMARY_GENDER: string;
  SUMMARY_NOTIFICATIONS: string;
  SUMMARY_NOT_PROVIDED: string;
  EDIT_NAME: string;
  EDIT_LOCATION: string;
  EDIT_ROLES: string;
  EDIT_INTERESTS: string;
  EDIT_GOALS: string;
  EDIT_EVENTS: string;
  EDIT_SOCIALS: string;
  EDIT_TELEGRAM: string;
  EDIT_GENDER: string;
  EDIT_NOTIFICATIONS: string;
  CONFIRM: string;
  NEXT_INSTRUCTION: string;
}

const translations: Record<LanguageCode, Messages> = {
  en: {
    GREETING: `Hello! I'm Agent Kaia, created by SI<3>. I'm your friendly guide to help you navigate Web3. I am here to support you in making meaningful connections and share helpful knowledge and opportunities within our member network. 💜

By continuing your interactions with me, you give your consent to sharing personal data in accordance with our privacy policy. https://si3.space/policy/privacy

Let's get started! What's your preferred name?`,
    LANGUAGE: `What's your preferred language?

1. English
2. Spanish
3. Portuguese
4. French

Reply with the number (for example: 1)`,
    LOCATION: `What's your location (city and country)? 📍 (optional)

To move on to the next question, type 'Next'`,
    ROLES: `To be able to match you with members and opportunities, can you tell me a bit about yourself by selecting the options that best describe you? You may select more than one.

1. Founder/Builder
2. Marketing/BD/Partnerships
3. DAO Council Member/Delegate
4. Community Leader
5. Investor/Grant Program Operator
6. Early Web3 Explorer
7. Media
8. Artist
9. Developer
10. Other

Reply with the number before the role (for example: 1, 4). If you have a role that is not listed, type that as text (for example: 1,4 and xx)`,
    INTERESTS: `As I am getting to know you better, can you please share what you are excited to explore in the Grow3dge program? You can select more than one topic.

1. Web3 Growth Marketing
2. Business Development & Partnerships
3. Education 3.0
4. AI
5. Cybersecurity
6. DAO's
7. Tokenomics
8. Fundraising
9. Other

Reply with the number before the topic (for example: 2,3). If you have a topic that is not listed, type that as text (for example: 2,3 and DevRel)`,
    GOALS: `I'd love to help you find the right connections - what are you looking for? 🤝

1. Startups to invest in
2. Investors/grant program operators
3. Marketing support
4. BD & Partnerships
5. Communities and/or DAO's to join
6. Other

Reply with the number before the connection type (for example: 3, 4). If you have a connection type that is not listed, type that as text (for example 3,4 and Cybersecurity).`,
    EVENTS: `I could try to connect you with others attending the same events and conferences! Can you share any events that you will be attending coming up (event name, month, and location)? (optional)

To move on to the next question, type 'Next'`,
    SOCIALS: `Can you share your digital links and/or social media profiles so we can share those with those that you are matched with? (optional)

To move on to the next question, type 'Next'`,
    TELEGRAM: `What's your Telegram handle so matches can reach you? (e.g., @username)`,
    GENDER: `We are an ecosystem that values the inclusion of under-represented groups in Web3. We are engaging in industry-related market research to support these groups in achieving more equitable access to funding, growth and career opportunities.

If you would like to share your gender data (anonymously) within our research, please provide how you identify: (optional)

1. She/Her
2. He/Him
3. They/Them
4. Other

To move on to the next question, type 'Next'`,
    NOTIFICATIONS: `One last thing…would you be interested in receiving notifications for project and mission collaboration opportunities initiated by SI<3> and it's partners? You're also welcome to share your organization's opportunities to broadcast to potentially interested members.

1. Yes!
2. No, thanks
3. Not sure yet, check in with me another time`,
    COMPLETION: `Thank you so much for onboarding! To get started, I will match you with members of our network where you both may be a fit for what you are looking for.`,
    SUMMARY_TITLE: `Here's your summary. Does it look right?`,
    SUMMARY_NAME: `Name:`,
    SUMMARY_LOCATION: `Location:`,
    SUMMARY_ROLES: `Professional Roles:`,
    SUMMARY_INTERESTS: `Learning Goals:`,
    SUMMARY_GOALS: `Connection Goals:`,
    SUMMARY_EVENTS: `Conferences Attending:`,
    SUMMARY_SOCIALS: `Personal Links:`,
    SUMMARY_TELEGRAM: `Telegram Handle:`,
    SUMMARY_GENDER: `Gender Info:`,
    SUMMARY_NOTIFICATIONS: `Notifications for Collabs:`,
    SUMMARY_NOT_PROVIDED: `Not provided`,
    EDIT_NAME: `Edit name`,
    EDIT_LOCATION: `Edit location`,
    EDIT_ROLES: `Edit professional roles`,
    EDIT_INTERESTS: `Edit learning Goals`,
    EDIT_GOALS: `Edit connection Goals`,
    EDIT_EVENTS: `Edit conferences attending`,
    EDIT_SOCIALS: `Edit personal links`,
    EDIT_TELEGRAM: `Edit telegram handle`,
    EDIT_GENDER: `Edit gender info`,
    EDIT_NOTIFICATIONS: `Edit notifications for collabs`,
    CONFIRM: `✅ Confirm`,
    NEXT_INSTRUCTION: `To move on to the next question, type 'Next'`
  },
  es: {
    GREETING: `¡Hola! Soy la Agente Kaia, creada por SI<3>. Soy tu guía amigable para ayudarte a navegar Web3. Estoy aquí para apoyarte a hacer conexiones significativas y compartir conocimientos útiles y oportunidades dentro de nuestra red de miembros. 💜

Al continuar tus interacciones conmigo, das tu consentimiento para compartir datos personales de acuerdo con nuestra política de privacidad. https://si3.space/policy/privacy

¡Empecemos! ¿Cuál es tu nombre preferido?`,
    LANGUAGE: `¿Cuál es tu idioma preferido?

1. Inglés
2. Español
3. Portugués
4. Francés

Responde con el número (por ejemplo: 1)`,
    LOCATION: `¿Cuál es tu ubicación (ciudad y país)? 📍 (opcional)

Para pasar a la siguiente pregunta, escribe 'Next'`,
    ROLES: `Para poder conectarte con miembros y oportunidades, ¿puedes contarme un poco sobre ti seleccionando las opciones que mejor te describen? Puedes seleccionar más de una.

1. Fundador/Constructor
2. Marketing/BD/Asociaciones
3. Miembro del Consejo DAO/Delegado
4. Líder Comunitario
5. Inversor/Operador de Programa de Subvenciones
6. Explorador Temprano de Web3
7. Medios
8. Artista
9. Desarrollador
10. Otro

Responde con el número antes del rol (por ejemplo: 1, 4). Si tienes un rol que no está en la lista, escríbelo como texto (por ejemplo: 1,4 y xx)`,
    INTERESTS: `Mientras te conozco mejor, ¿puedes compartir qué te emociona explorar en el programa Grow3dge? Puedes seleccionar más de un tema.

1. Marketing de Crecimiento Web3
2. Desarrollo de Negocios y Asociaciones
3. Educación 3.0
4. IA
5. Ciberseguridad
6. DAOs
7. Tokenomics
8. Recaudación de Fondos
9. Otro

Responde con el número antes del tema (por ejemplo: 2,3). Si tienes un tema que no está en la lista, escríbelo como texto (por ejemplo: 2,3 y DevRel)`,
    GOALS: `Me encantaría ayudarte a encontrar las conexiones adecuadas: ¿qué estás buscando? 🤝

1. Startups en las que invertir
2. Inversores/operadores de programas de subvenciones
3. Apoyo de marketing
4. BD y Asociaciones
5. Comunidades y/o DAOs a las que unirse
6. Otro

Responde con el número antes del tipo de conexión (por ejemplo: 3, 4). Si tienes un tipo de conexión que no está en la lista, escríbelo como texto (por ejemplo 3,4 y Ciberseguridad).`,
    EVENTS: `¡Podría intentar conectarte con otros que asistirán a los mismos eventos y conferencias! ¿Puedes compartir algún evento al que asistirás próximamente (nombre del evento, mes y ubicación)? (opcional)

Para pasar a la siguiente pregunta, escribe 'Next'`,
    SOCIALS: `¿Puedes compartir tus enlaces digitales y/o perfiles de redes sociales para que podamos compartirlos con aquellos con los que te conectemos? (opcional)

Para pasar a la siguiente pregunta, escribe 'Next'`,
    TELEGRAM: `¿Cuál es tu nombre de usuario de Telegram para que las conexiones puedan contactarte? (por ejemplo: @usuario)`,
    GENDER: `Somos un ecosistema que valora la inclusión de grupos subrepresentados en Web3. Estamos realizando investigaciones de mercado relacionadas con la industria para apoyar a estos grupos a lograr un acceso más equitativo a financiamiento, crecimiento y oportunidades profesionales.

Si deseas compartir tus datos de género (de forma anónima) en nuestra investigación, proporciona cómo te identificas: (opcional)

1. Ella
2. Él
3. Ellos/Ellas
4. Otro

Para pasar a la siguiente pregunta, escribe 'Next'`,
    NOTIFICATIONS: `Una última cosa... ¿estarías interesado en recibir notificaciones de oportunidades de colaboración de proyectos y misiones iniciadas por SI<3> y sus socios? También puedes compartir las oportunidades de tu organización para difundirlas a miembros potencialmente interesados.

1. ¡Sí!
2. No, gracias
3. No estoy seguro aún, contáctame en otro momento`,
    COMPLETION: `¡Muchas gracias por completar el registro! Para comenzar, te conectaré con miembros de nuestra red donde ambos puedan ser una buena opción para lo que estás buscando.`,
    SUMMARY_TITLE: `Aquí está tu resumen. ¿Se ve bien?`,
    SUMMARY_NAME: `Nombre:`,
    SUMMARY_LOCATION: `Ubicación:`,
    SUMMARY_ROLES: `Roles Profesionales:`,
    SUMMARY_INTERESTS: `Objetivos de Aprendizaje:`,
    SUMMARY_GOALS: `Objetivos de Conexión:`,
    SUMMARY_EVENTS: `Conferencias a las que Asistirás:`,
    SUMMARY_SOCIALS: `Enlaces Personales:`,
    SUMMARY_TELEGRAM: `Nombre de Usuario de Telegram:`,
    SUMMARY_GENDER: `Información de Género:`,
    SUMMARY_NOTIFICATIONS: `Notificaciones para Colaboraciones:`,
    SUMMARY_NOT_PROVIDED: `No proporcionado`,
    EDIT_NAME: `Editar nombre`,
    EDIT_LOCATION: `Editar ubicación`,
    EDIT_ROLES: `Editar roles profesionales`,
    EDIT_INTERESTS: `Editar objetivos de aprendizaje`,
    EDIT_GOALS: `Editar objetivos de conexión`,
    EDIT_EVENTS: `Editar conferencias a las que asistirás`,
    EDIT_SOCIALS: `Editar enlaces personales`,
    EDIT_TELEGRAM: `Editar nombre de usuario de Telegram`,
    EDIT_GENDER: `Editar información de género`,
    EDIT_NOTIFICATIONS: `Editar notificaciones para colaboraciones`,
    CONFIRM: `✅ Confirmar`,
    NEXT_INSTRUCTION: `Para pasar a la siguiente pregunta, escribe 'Next'`
  },
  pt: {
    GREETING: `Olá! Sou a Agente Kaia, criada pela SI<3>. Sou sua guia amigável para ajudá-lo a navegar na Web3. Estou aqui para apoiá-lo a fazer conexões significativas e compartilhar conhecimentos úteis e oportunidades dentro de nossa rede de membros. 💜

Ao continuar suas interações comigo, você consente em compartilhar dados pessoais de acordo com nossa política de privacidade. https://si3.space/policy/privacy

Vamos começar! Qual é o seu nome preferido?`,
    LANGUAGE: `Qual é o seu idioma preferido?

1. Inglês
2. Espanhol
3. Português
4. Francês

Responda com o número (por exemplo: 1)`,
    LOCATION: `Qual é a sua localização (cidade e país)? 📍 (opcional)

Para passar para a próxima pergunta, digite 'Next'`,
    ROLES: `Para poder conectá-lo com membros e oportunidades, você pode me contar um pouco sobre si mesmo selecionando as opções que melhor o descrevem? Você pode selecionar mais de uma.

1. Fundador/Construtor
2. Marketing/BD/Parcerias
3. Membro do Conselho DAO/Delegado
4. Líder Comunitário
5. Investidor/Operador de Programa de Subsídios
6. Explorador Inicial de Web3
7. Mídia
8. Artista
9. Desenvolvedor
10. Outro

Responda com o número antes da função (por exemplo: 1, 4). Se você tem uma função que não está na lista, digite isso como texto (por exemplo: 1,4 e xx)`,
    INTERESTS: `Enquanto te conheço melhor, você pode compartilhar o que está animado para explorar no programa Grow3dge? Você pode selecionar mais de um tópico.

1. Marketing de Crescimento Web3
2. Desenvolvimento de Negócios e Parcerias
3. Educação 3.0
4. IA
5. Cibersegurança
6. DAOs
7. Tokenomics
8. Captação de Recursos
9. Outro

Responda com o número antes do tópico (por exemplo: 2,3). Se você tem um tópico que não está na lista, digite isso como texto (por exemplo: 2,3 e DevRel)`,
    GOALS: `Adoraria ajudá-lo a encontrar as conexões certas - o que você está procurando? 🤝

1. Startups para investir
2. Investidores/operadores de programas de subsídios
3. Suporte de marketing
4. BD e Parcerias
5. Comunidades e/ou DAOs para participar
6. Outro

Responda com o número antes do tipo de conexão (por exemplo: 3, 4). Se você tem um tipo de conexão que não está na lista, digite isso como texto (por exemplo 3,4 e Cibersegurança).`,
    EVENTS: `Eu poderia tentar conectá-lo com outros que estão participando dos mesmos eventos e conferências! Você pode compartilhar algum evento que participará em breve (nome do evento, mês e localização)? (opcional)

Para passar para a próxima pergunta, digite 'Next'`,
    SOCIALS: `Você pode compartilhar seus links digitais e/ou perfis de redes sociais para que possamos compartilhá-los com aqueles com quem você for conectado? (opcional)

Para passar para a próxima pergunta, digite 'Next'`,
    TELEGRAM: `Qual é o seu nome de usuário do Telegram para que as conexões possam entrar em contato? (por exemplo: @usuario)`,
    GENDER: `Somos um ecossistema que valoriza a inclusão de grupos sub-representados na Web3. Estamos realizando pesquisas de mercado relacionadas à indústria para apoiar esses grupos a alcançar acesso mais equitativo a financiamento, crescimento e oportunidades de carreira.

Se você gostaria de compartilhar seus dados de gênero (anonimamente) em nossa pesquisa, forneça como você se identifica: (opcional)

1. Ela
2. Ele
3. Eles/Elas
4. Outro

Para passar para a próxima pergunta, digite 'Next'`,
    NOTIFICATIONS: `Uma última coisa... você estaria interessado em receber notificações de oportunidades de colaboração de projetos e missões iniciadas pela SI<3> e seus parceiros? Você também pode compartilhar as oportunidades da sua organização para transmitir a membros potencialmente interessados.

1. Sim!
2. Não, obrigado
3. Ainda não tenho certeza, entre em contato comigo em outro momento`,
    COMPLETION: `Muito obrigado por se registrar! Para começar, vou conectá-lo com membros de nossa rede onde ambos podem ser uma boa opção para o que você está procurando.`,
    SUMMARY_TITLE: `Aqui está o seu resumo. Parece correto?`,
    SUMMARY_NAME: `Nome:`,
    SUMMARY_LOCATION: `Localização:`,
    SUMMARY_ROLES: `Funções Profissionais:`,
    SUMMARY_INTERESTS: `Objetivos de Aprendizagem:`,
    SUMMARY_GOALS: `Objetivos de Conexão:`,
    SUMMARY_EVENTS: `Conferências que Participará:`,
    SUMMARY_SOCIALS: `Links Pessoais:`,
    SUMMARY_TELEGRAM: `Nome de Usuário do Telegram:`,
    SUMMARY_GENDER: `Informações de Gênero:`,
    SUMMARY_NOTIFICATIONS: `Notificações para Colaborações:`,
    SUMMARY_NOT_PROVIDED: `Não fornecido`,
    EDIT_NAME: `Editar nome`,
    EDIT_LOCATION: `Editar localização`,
    EDIT_ROLES: `Editar funções profissionais`,
    EDIT_INTERESTS: `Editar objetivos de aprendizagem`,
    EDIT_GOALS: `Editar objetivos de conexão`,
    EDIT_EVENTS: `Editar conferências que participará`,
    EDIT_SOCIALS: `Editar links pessoais`,
    EDIT_TELEGRAM: `Editar nome de usuário do Telegram`,
    EDIT_GENDER: `Editar informações de gênero`,
    EDIT_NOTIFICATIONS: `Editar notificações para colaborações`,
    CONFIRM: `✅ Confirmar`,
    NEXT_INSTRUCTION: `Para passar para a próxima pergunta, digite 'Next'`
  },
  fr: {
    GREETING: `Bonjour! Je suis l'Agent Kaia, créée par SI<3>. Je suis votre guide amical pour vous aider à naviguer dans Web3. Je suis là pour vous soutenir dans la création de connexions significatives et partager des connaissances utiles et des opportunités au sein de notre réseau de membres. 💜

En continuant vos interactions avec moi, vous consentez à partager des données personnelles conformément à notre politique de confidentialité. https://si3.space/policy/privacy

Commençons! Quel est votre nom préféré?`,
    LANGUAGE: `Quelle est votre langue préférée?

1. Anglais
2. Espagnol
3. Portugais
4. Français

Répondez avec le numéro (par exemple: 1)`,
    LOCATION: `Quelle est votre localisation (ville et pays)? 📍 (optionnel)

Pour passer à la question suivante, tapez 'Next'`,
    ROLES: `Pour pouvoir vous mettre en relation avec des membres et des opportunités, pouvez-vous me parler un peu de vous en sélectionnant les options qui vous décrivent le mieux? Vous pouvez en sélectionner plusieurs.

1. Fondateur/Constructeur
2. Marketing/BD/Partenariats
3. Membre du Conseil DAO/Délégué
4. Leader Communautaire
5. Investisseur/Opérateur de Programme de Subventions
6. Explorateur Précoce de Web3
7. Médias
8. Artiste
9. Développeur
10. Autre

Répondez avec le numéro avant le rôle (par exemple: 1, 4). Si vous avez un rôle qui n'est pas dans la liste, tapez-le en texte (par exemple: 1,4 et xx)`,
    INTERESTS: `Alors que je vous connais mieux, pouvez-vous partager ce qui vous passionne d'explorer dans le programme Grow3dge? Vous pouvez sélectionner plus d'un sujet.

1. Marketing de Croissance Web3
2. Développement Commercial et Partenariats
3. Éducation 3.0
4. IA
5. Cybersécurité
6. DAOs
7. Tokenomics
8. Collecte de Fonds
9. Autre

Répondez avec le numéro avant le sujet (par exemple: 2,3). Si vous avez un sujet qui n'est pas dans la liste, tapez-le en texte (par exemple: 2,3 et DevRel)`,
    GOALS: `J'aimerais vous aider à trouver les bonnes connexions - que recherchez-vous? 🤝

1. Startups dans lesquelles investir
2. Investisseurs/opérateurs de programmes de subventions
3. Support marketing
4. BD et Partenariats
5. Communautés et/ou DAOs à rejoindre
6. Autre

Répondez avec le numéro avant le type de connexion (par exemple: 3, 4). Si vous avez un type de connexion qui n'est pas dans la liste, tapez-le en texte (par exemple 3,4 et Cybersécurité).`,
    EVENTS: `Je pourrais essayer de vous connecter avec d'autres qui assistent aux mêmes événements et conférences! Pouvez-vous partager des événements auxquels vous assisterez prochainement (nom de l'événement, mois et lieu)? (optionnel)

Pour passer à la question suivante, tapez 'Next'`,
    SOCIALS: `Pouvez-vous partager vos liens numériques et/ou profils de réseaux sociaux afin que nous puissions les partager avec ceux avec qui vous êtes mis en relation? (optionnel)

Pour passer à la question suivante, tapez 'Next'`,
    TELEGRAM: `Quel est votre nom d'utilisateur Telegram pour que les correspondances puissent vous contacter? (par exemple: @utilisateur)`,
    GENDER: `Nous sommes un écosystème qui valorise l'inclusion de groupes sous-représentés dans Web3. Nous menons des recherches de marché liées à l'industrie pour soutenir ces groupes à atteindre un accès plus équitable au financement, à la croissance et aux opportunités de carrière.

Si vous souhaitez partager vos données de genre (anonymement) dans notre recherche, veuillez indiquer comment vous vous identifiez: (optionnel)

1. Elle
2. Il
3. Ils/Elles
4. Autre

Pour passer à la question suivante, tapez 'Next'`,
    NOTIFICATIONS: `Une dernière chose... seriez-vous intéressé à recevoir des notifications pour les opportunités de collaboration de projets et de missions initiées par SI<3> et ses partenaires? Vous êtes également invité à partager les opportunités de votre organisation pour les diffuser aux membres potentiellement intéressés.

1. Oui!
2. Non, merci
3. Pas encore sûr, contactez-moi à un autre moment`,
    COMPLETION: `Merci beaucoup pour votre inscription! Pour commencer, je vais vous mettre en relation avec des membres de notre réseau où vous pourriez tous deux être un bon match pour ce que vous recherchez.`,
    SUMMARY_TITLE: `Voici votre résumé. Cela semble correct?`,
    SUMMARY_NAME: `Nom:`,
    SUMMARY_LOCATION: `Localisation:`,
    SUMMARY_ROLES: `Rôles Professionnels:`,
    SUMMARY_INTERESTS: `Objectifs d'Apprentissage:`,
    SUMMARY_GOALS: `Objectifs de Connexion:`,
    SUMMARY_EVENTS: `Conférences auxquelles Vous Assisterez:`,
    SUMMARY_SOCIALS: `Liens Personnels:`,
    SUMMARY_TELEGRAM: `Nom d'Utilisateur Telegram:`,
    SUMMARY_GENDER: `Informations de Genre:`,
    SUMMARY_NOTIFICATIONS: `Notifications pour Collaborations:`,
    SUMMARY_NOT_PROVIDED: `Non fourni`,
    EDIT_NAME: `Modifier le nom`,
    EDIT_LOCATION: `Modifier la localisation`,
    EDIT_ROLES: `Modifier les rôles professionnels`,
    EDIT_INTERESTS: `Modifier les objectifs d'apprentissage`,
    EDIT_GOALS: `Modifier les objectifs de connexion`,
    EDIT_EVENTS: `Modifier les conférences auxquelles vous assisterez`,
    EDIT_SOCIALS: `Modifier les liens personnels`,
    EDIT_TELEGRAM: `Modifier le nom d'utilisateur Telegram`,
    EDIT_GENDER: `Modifier les informations de genre`,
    EDIT_NOTIFICATIONS: `Modifier les notifications pour collaborations`,
    CONFIRM: `✅ Confirmer`,
    NEXT_INSTRUCTION: `Pour passer à la question suivante, tapez 'Next'`
  }
};

export function getMessages(lang: LanguageCode = 'en'): Messages {
  return translations[lang] || translations.en;
}

export function parseLanguageCode(input: string): LanguageCode | null {
  const trimmed = input.trim();
  if (trimmed === '1' || trimmed.toLowerCase() === 'english' || trimmed.toLowerCase() === 'en') return 'en';
  if (trimmed === '2' || trimmed.toLowerCase() === 'spanish' || trimmed.toLowerCase() === 'español' || trimmed.toLowerCase() === 'es') return 'es';
  if (trimmed === '3' || trimmed.toLowerCase() === 'portuguese' || trimmed.toLowerCase() === 'português' || trimmed.toLowerCase() === 'pt') return 'pt';
  if (trimmed === '4' || trimmed.toLowerCase() === 'french' || trimmed.toLowerCase() === 'français' || trimmed.toLowerCase() === 'fr') return 'fr';
  return null;
}

