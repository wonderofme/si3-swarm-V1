export type LanguageCode = 'en' | 'es' | 'pt' | 'fr';
export type Platform = 'grow3dge' | 'siher' | 'default';

export interface Messages {
  GREETING: string;
  LANGUAGE: string;
  LOCATION: string;
  EMAIL: string;
  PROFILE_EXISTS: string;
  PROFILE_CHOICE: string;
  ROLES: string;
  INTERESTS: string;
  GOALS: string;
  EVENTS: string;
  SOCIALS: string;
  TELEGRAM: string;
  GENDER: string;
  NOTIFICATIONS: string;
  COMPLETION: string;
  COMPLETION_2: string;
  SUMMARY_TITLE: string;
  SUMMARY_NAME: string;
  SUMMARY_LOCATION: string;
  SUMMARY_EMAIL: string;
  SUMMARY_ROLES: string;
  SUMMARY_INTERESTS: string;
  SUMMARY_GOALS: string;
  SUMMARY_EVENTS: string;
  SUMMARY_SOCIALS: string;
  SUMMARY_TELEGRAM: string;
  SUMMARY_GENDER: string;
  SUMMARY_DIVERSITY: string;
  SUMMARY_NOTIFICATIONS: string;
  SUMMARY_NOT_PROVIDED: string;
  EDIT_NAME: string;
  EDIT_LOCATION: string;
  EDIT_EMAIL: string;
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
  PROFILE_TITLE: string;
  // NEW: SI U onboarding messages
  ENTRY_METHOD: string;
  WALLET_CONNECTION: string;
  WALLET_CONNECTED: string;
  WALLET_ALREADY_REGISTERED: string;
  SIU_NAME: string;
  SIU_NAME_INVALID: string;
  SIU_NAME_TAKEN: string;
  SIU_NAME_CLAIMED: string;
  SUMMARY_WALLET: string;
  SUMMARY_SIU_NAME: string;
  EDIT_WALLET: string;
  EDIT_SIU_NAME: string;
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
    EMAIL: `To help us connect your profile with your SI<3> Her and/or Grow3dge account, please share the email address you registered with.

What's your email address?`,
    PROFILE_EXISTS: `We found an existing Agent Kaia profile connected to this email address.`,
    PROFILE_CHOICE: `Would you like to:

1. Continue with your existing profile
2. Create a new profile

Reply with the number (for example: 1)`,
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
    INTERESTS: `As I am getting to know you better, can you please share what you are excited to explore? You can select more than one topic.

1. Web3 Growth Marketing
2. Sales, BD & Partnerships
3. Education 3.0
4. AI
5. Cybersecurity
6. DAO's
7. Tokenomics
8. Fundraising
9. DeepTech

Reply with the number before the topic (for example: 2,3). If you have a topic that is not listed, type that as text (for example: 2,3 and DevRel)`,
    GOALS: `I'd love to help you find the right connections - what are you looking for? 🤝

1. Startups to invest in
2. Investors/grant programs
3. Growth tools, strategies, and/or support
4. Sales/BD tools, strategies and/or support
5. Communities and/or DAO's to join
6. New job opportunities

Reply with the number before the connection type (for example: 3, 4). If you have a connection type that is not listed, type that as text (for example 3,4 and Cybersecurity).`,
    EVENTS: `I am also able to match you with other SI<3> members that are attending the same events and conferences.

Can you share any events that you will be attending coming up (event name, date, and location)? (optional)

To move on to the next question, type 'Next'`,
    SOCIALS: `Can you share your digital links and/or social media profiles so we can share those with your matches? (optional)

To move on to the next question, type 'Next'`,
    TELEGRAM: `What's your Telegram handle so members that you match with can reach you? (e.g., @username)`,
    GENDER: `We are an ecosystem that values the inclusion of under-represented groups in Web3. We are engaging in industry-related market research to support these groups in achieving more equitable access to funding, growth and career opportunities.

If you would like to be (anonymously) included within our research, please say Yes, Diversity and we will follow up with you soon with our research questions and policies.

To move on to the next question, type 'Next'`,
    NOTIFICATIONS: `One last thing…would you be interested in receiving notifications for project and mission collaboration opportunities initiated by SI<3> and its ecosystem partners?

1. Yes!
2. No, thanks
3. Not sure yet, check in with me another time

Please reply with the number (for example: 1)`,
    COMPLETION: `Thank you so much for onboarding! 

Please see your member profile here. At any time you would like to edit this data, please type 'Edit Profile' and I will help you make updates.

In the meantime, I will let you know when I have a member match for you.`,
    COMPLETION_2: ``, // Deprecated - keeping for backwards compatibility
    SUMMARY_TITLE: `Here's your summary. Does it look right?`,
    SUMMARY_NAME: `Name:`,
    SUMMARY_LOCATION: `Location:`,
    SUMMARY_EMAIL: `Email:`,
    SUMMARY_ROLES: `Professional Roles:`,
    SUMMARY_INTERESTS: `Learning Goals:`,
    SUMMARY_GOALS: `Connection Goals:`,
    SUMMARY_EVENTS: `Conferences Attending:`,
    SUMMARY_SOCIALS: `Personal Links:`,
    SUMMARY_TELEGRAM: `Telegram Handle:`,
    SUMMARY_GENDER: `Gender Info:`,
    SUMMARY_DIVERSITY: `Diversity Research Interest:`,
    SUMMARY_NOTIFICATIONS: `Notifications for Collabs:`,
    SUMMARY_NOT_PROVIDED: `Not provided`,
    EDIT_NAME: `Edit name`,
    EDIT_LOCATION: `Edit location`,
    EDIT_EMAIL: `Edit email`,
    EDIT_ROLES: `Edit professional roles`,
    EDIT_INTERESTS: `Edit learning Goals`,
    EDIT_GOALS: `Edit connection Goals`,
    EDIT_EVENTS: `Edit conferences attending`,
    EDIT_SOCIALS: `Edit personal links`,
    EDIT_TELEGRAM: `Edit telegram handle`,
    EDIT_GENDER: `Edit gender info`,
    EDIT_NOTIFICATIONS: `Edit notifications for collabs`,
    CONFIRM: `✅ Confirm`,
    NEXT_INSTRUCTION: `To move on to the next question, type 'Next'`,
    PROFILE_TITLE: `💜 Your Grow3dge Profile:`,
    // NEW: SI U onboarding messages
    ENTRY_METHOD: `Welcome to SI U! 🎉 How would you like to sign up?

1. Connect Wallet (Recommended)
2. Continue with Email

Reply with the number (for example: 1)`,
    WALLET_CONNECTION: `Great! Please connect your wallet to continue.

Your wallet address will be securely linked to your SI U profile. This allows you to access exclusive features and claim your SI U name.

[The frontend will display wallet connection options]`,
    WALLET_CONNECTED: `✅ Wallet connected successfully!

Wallet: {walletAddress}`,
    WALLET_ALREADY_REGISTERED: `This wallet address is already registered with another account. Please use a different wallet or continue with email.`,
    SIU_NAME: `Now let's claim your SI U name! 🏷️

Your SI U name is your unique identity across the SI<3> ecosystem (e.g., yourname.siu).

What SI U name would you like to claim?

Rules:
• 3-20 characters
• Letters and numbers only
• Not case sensitive

Example: If you type "myname", you'll get myname.siu`,
    SIU_NAME_INVALID: `Sorry, that SI U name is not valid. Please choose a name that:
• Has 3-20 characters
• Contains only letters and numbers (no spaces or special characters)

Try again:`,
    SIU_NAME_TAKEN: `Sorry, {siuName} is already taken. Please choose a different name:`,
    SIU_NAME_CLAIMED: `🎉 Congrats! You've claimed {siuName}!

This is your unique identity in the SI<3> ecosystem.`,
    SUMMARY_WALLET: `Wallet:`,
    SUMMARY_SIU_NAME: `SI U Name:`,
    EDIT_WALLET: `Edit wallet`,
    EDIT_SIU_NAME: `Edit SI U name`
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
    EMAIL: `Para ayudarnos a conectar tu perfil con tu cuenta de SI<3> Her y/o Grow3dge, por favor comparte la dirección de correo electrónico con la que te registraste.

¿Cuál es tu dirección de correo electrónico?`,
    PROFILE_EXISTS: `Encontramos un perfil existente de Agent Kaia conectado a esta dirección de correo electrónico.`,
    PROFILE_CHOICE: `¿Te gustaría:

1. Continuar con tu perfil existente
2. Crear un nuevo perfil

Responde con el número (por ejemplo: 1)`,
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
2. Ventas, BD y Asociaciones
3. Educación 3.0
4. IA
5. Ciberseguridad
6. DAOs
7. Tokenomics
8. Recaudación de Fondos
9. DeepTech

Responde con el número antes del tema (por ejemplo: 2,3). Si tienes un tema que no está en la lista, escríbelo como texto (por ejemplo: 2,3 y DevRel)`,
    GOALS: `Me encantaría ayudarte a encontrar las conexiones adecuadas: ¿qué estás buscando? 🤝

1. Startups en las que invertir
2. Inversores/programas de subvenciones
3. Herramientas, estrategias y/o apoyo de crecimiento
4. Herramientas, estrategias y/o apoyo de Ventas/BD
5. Comunidades y/o DAOs a las que unirse
6. Nuevas oportunidades laborales

Responde con el número antes del tipo de conexión (por ejemplo: 3, 4). Si tienes un tipo de conexión que no está en la lista, escríbelo como texto (por ejemplo 3,4 y Ciberseguridad).`,
    EVENTS: `También puedo conectarte con otros miembros de Grow3dge que asistirán a los mismos eventos y conferencias.

¿Puedes compartir algún evento al que asistirás próximamente (nombre del evento, fecha y ubicación)? (opcional)

Para pasar a la siguiente pregunta, escribe 'Next'`,
    SOCIALS: `¿Puedes compartir tus enlaces digitales y/o perfiles de redes sociales para que podamos compartirlos con tus conexiones? (opcional)

Para pasar a la siguiente pregunta, escribe 'Next'`,
    TELEGRAM: `¿Cuál es tu nombre de usuario de Telegram para que los miembros con los que te conectes puedan contactarte? (por ejemplo: @usuario)`,
    GENDER: `Somos un ecosistema que valora la inclusión de grupos subrepresentados en Web3. Estamos realizando investigaciones de mercado relacionadas con la industria para apoyar a estos grupos a lograr un acceso más equitativo a financiamiento, crecimiento y oportunidades profesionales.

Si deseas ser (anónimamente) incluido en nuestra investigación, por favor di Sí, Diversidad y te contactaremos pronto con nuestras preguntas de investigación y políticas.

Para pasar a la siguiente pregunta, escribe 'Next'`,
    NOTIFICATIONS: `Una última cosa... ¿estarías interesado en recibir notificaciones de oportunidades de colaboración de proyectos y misiones iniciadas por SI<3> y sus socios del ecosistema?

1. ¡Sí!
2. No, gracias
3. No estoy seguro aún, contáctame en otro momento

Por favor responde con el número (por ejemplo: 1)`,
    COMPLETION: `¡Muchas gracias por completar el registro! 

Por favor consulta tu perfil de miembro aquí. En cualquier momento que desees editar esta información, escribe 'Edit Profile' y te ayudaré a hacer actualizaciones.

Mientras tanto, te avisaré cuando tenga una conexión de miembro para ti.`,
    COMPLETION_2: ``, // Deprecated - keeping for backwards compatibility
    SUMMARY_TITLE: `Aquí está tu resumen. ¿Se ve bien?`,
    SUMMARY_NAME: `Nombre:`,
    SUMMARY_LOCATION: `Ubicación:`,
    SUMMARY_EMAIL: `Correo electrónico:`,
    SUMMARY_ROLES: `Roles Profesionales:`,
    SUMMARY_INTERESTS: `Objetivos de Aprendizaje:`,
    SUMMARY_GOALS: `Objetivos de Conexión:`,
    SUMMARY_EVENTS: `Conferencias a las que Asistirás:`,
    SUMMARY_SOCIALS: `Enlaces Personales:`,
    SUMMARY_TELEGRAM: `Nombre de Usuario de Telegram:`,
    SUMMARY_GENDER: `Información de Género:`,
    SUMMARY_DIVERSITY: `Interés en Investigación de Diversidad:`,
    SUMMARY_NOTIFICATIONS: `Notificaciones para Colaboraciones:`,
    SUMMARY_NOT_PROVIDED: `No proporcionado`,
    EDIT_NAME: `Editar nombre`,
    EDIT_LOCATION: `Editar ubicación`,
    EDIT_EMAIL: `Editar correo electrónico`,
    EDIT_ROLES: `Editar roles profesionales`,
    EDIT_INTERESTS: `Editar objetivos de aprendizaje`,
    EDIT_GOALS: `Editar objetivos de conexión`,
    EDIT_EVENTS: `Editar conferencias a las que asistirás`,
    EDIT_SOCIALS: `Editar enlaces personales`,
    EDIT_TELEGRAM: `Editar nombre de usuario de Telegram`,
    EDIT_GENDER: `Editar información de género`,
    EDIT_NOTIFICATIONS: `Editar notificaciones para colaboraciones`,
    CONFIRM: `✅ Confirmar`,
    NEXT_INSTRUCTION: `Para pasar a la siguiente pregunta, escribe 'Next'`,
    PROFILE_TITLE: `💜 Tu Perfil de Grow3dge:`,
    // NEW: SI U onboarding messages
    ENTRY_METHOD: `¡Bienvenido a SI U! 🎉 ¿Cómo te gustaría registrarte?

1. Conectar Billetera (Recomendado)
2. Continuar con Correo Electrónico

Responde con el número (por ejemplo: 1)`,
    WALLET_CONNECTION: `¡Genial! Por favor conecta tu billetera para continuar.

Tu dirección de billetera se vinculará de forma segura a tu perfil de SI U. Esto te permite acceder a funciones exclusivas y reclamar tu nombre SI U.

[El frontend mostrará las opciones de conexión de billetera]`,
    WALLET_CONNECTED: `✅ ¡Billetera conectada exitosamente!

Billetera: {walletAddress}`,
    WALLET_ALREADY_REGISTERED: `Esta dirección de billetera ya está registrada con otra cuenta. Por favor usa una billetera diferente o continúa con correo electrónico.`,
    SIU_NAME: `¡Ahora reclamemos tu nombre SI U! 🏷️

Tu nombre SI U es tu identidad única en el ecosistema SI<3> (por ejemplo, tunombre.siu).

¿Qué nombre SI U te gustaría reclamar?

Reglas:
• 3-20 caracteres
• Solo letras y números
• No distingue mayúsculas de minúsculas

Ejemplo: Si escribes "minombre", obtendrás minombre.siu`,
    SIU_NAME_INVALID: `Lo siento, ese nombre SI U no es válido. Por favor elige un nombre que:
• Tenga 3-20 caracteres
• Contenga solo letras y números (sin espacios ni caracteres especiales)

Intenta de nuevo:`,
    SIU_NAME_TAKEN: `Lo siento, {siuName} ya está tomado. Por favor elige un nombre diferente:`,
    SIU_NAME_CLAIMED: `🎉 ¡Felicidades! ¡Has reclamado {siuName}!

Esta es tu identidad única en el ecosistema SI<3>.`,
    SUMMARY_WALLET: `Billetera:`,
    SUMMARY_SIU_NAME: `Nombre SI U:`,
    EDIT_WALLET: `Editar billetera`,
    EDIT_SIU_NAME: `Editar nombre SI U`
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
    EMAIL: `Para nos ajudar a conectar seu perfil com sua conta do SI<3> Her e/ou Grow3dge, por favor compartilhe o endereço de e-mail com o qual você se registrou.

Qual é o seu endereço de e-mail?`,
    PROFILE_EXISTS: `Encontramos um perfil existente do Agent Kaia conectado a este endereço de e-mail.`,
    PROFILE_CHOICE: `Você gostaria de:

1. Continuar com seu perfil existente
2. Criar um novo perfil

Responda com o número (por exemplo: 1)`,
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
2. Vendas, BD e Parcerias
3. Educação 3.0
4. IA
5. Cibersegurança
6. DAOs
7. Tokenomics
8. Captação de Recursos
9. DeepTech

Responda com o número antes do tópico (por exemplo: 2,3). Se você tem um tópico que não está na lista, digite isso como texto (por exemplo: 2,3 e DevRel)`,
    GOALS: `Adoraria ajudá-lo a encontrar as conexões certas - o que você está procurando? 🤝

1. Startups para investir
2. Investidores/programas de subsídios
3. Ferramentas, estratégias e/ou suporte de crescimento
4. Ferramentas, estratégias e/ou suporte de Vendas/BD
5. Comunidades e/ou DAOs para participar
6. Novas oportunidades de emprego

Responda com o número antes do tipo de conexão (por exemplo: 3, 4). Se você tem um tipo de conexão que não está na lista, digite isso como texto (por exemplo 3,4 e Cibersegurança).`,
    EVENTS: `Também posso conectá-lo com outros membros do Grow3dge que participarão dos mesmos eventos e conferências.

Você pode compartilhar algum evento que participará em breve (nome do evento, data e localização)? (opcional)

Para passar para a próxima pergunta, digite 'Next'`,
    SOCIALS: `Você pode compartilhar seus links digitais e/ou perfis de redes sociais para que possamos compartilhá-los com suas conexões? (opcional)

Para passar para a próxima pergunta, digite 'Next'`,
    TELEGRAM: `Qual é o seu nome de usuário do Telegram para que os membros com os quais você se conectar possam entrar em contato? (por exemplo: @usuario)`,
    GENDER: `Somos um ecossistema que valoriza a inclusão de grupos sub-representados na Web3. Estamos realizando pesquisas de mercado relacionadas à indústria para apoiar esses grupos a alcançar acesso mais equitativo a financiamento, crescimento e oportunidades de carreira.

Se você gostaria de ser (anonimamente) incluído em nossa pesquisa, por favor diga Sim, Diversidade e entraremos em contato em breve com nossas perguntas de pesquisa e políticas.

Para passar para a próxima pergunta, digite 'Next'`,
    NOTIFICATIONS: `Uma última coisa... você estaria interessado em receber notificações de oportunidades de colaboração de projetos e missões iniciadas pela SI<3> e seus parceiros do ecossistema?

1. Sim!
2. Não, obrigado
3. Ainda não tenho certeza, entre em contato comigo em outro momento

Por favor responda com o número (por exemplo: 1)`,
    COMPLETION: `Muito obrigado por se registrar! 

Por favor, consulte seu perfil de membro aqui. A qualquer momento que desejar editar essas informações, digite 'Edit Profile' e eu o ajudarei a fazer atualizações.

Enquanto isso, avisarei quando tiver uma conexão de membro para você.`,
    COMPLETION_2: ``, // Deprecated - keeping for backwards compatibility
    SUMMARY_TITLE: `Aqui está o seu resumo. Parece correto?`,
    SUMMARY_NAME: `Nome:`,
    SUMMARY_LOCATION: `Localização:`,
    SUMMARY_EMAIL: `E-mail:`,
    SUMMARY_ROLES: `Funções Profissionais:`,
    SUMMARY_INTERESTS: `Objetivos de Aprendizagem:`,
    SUMMARY_GOALS: `Objetivos de Conexão:`,
    SUMMARY_EVENTS: `Conferências que Participará:`,
    SUMMARY_SOCIALS: `Links Pessoais:`,
    SUMMARY_TELEGRAM: `Nome de Usuário do Telegram:`,
    SUMMARY_GENDER: `Informações de Gênero:`,
    SUMMARY_DIVERSITY: `Interesse em Pesquisa de Diversidade:`,
    SUMMARY_NOTIFICATIONS: `Notificações para Colaborações:`,
    SUMMARY_NOT_PROVIDED: `Não fornecido`,
    EDIT_NAME: `Editar nome`,
    EDIT_LOCATION: `Editar localização`,
    EDIT_EMAIL: `Editar e-mail`,
    EDIT_ROLES: `Editar funções profissionais`,
    EDIT_INTERESTS: `Editar objetivos de aprendizagem`,
    EDIT_GOALS: `Editar objetivos de conexão`,
    EDIT_EVENTS: `Editar conferências que participará`,
    EDIT_SOCIALS: `Editar links pessoais`,
    EDIT_TELEGRAM: `Editar nome de usuário do Telegram`,
    EDIT_GENDER: `Editar informações de gênero`,
    EDIT_NOTIFICATIONS: `Editar notificações para colaborações`,
    CONFIRM: `✅ Confirmar`,
    NEXT_INSTRUCTION: `Para passar para a próxima pergunta, digite 'Next'`,
    PROFILE_TITLE: `💜 Seu Perfil Grow3dge:`,
    // NEW: SI U onboarding messages
    ENTRY_METHOD: `Bem-vindo ao SI U! 🎉 Como você gostaria de se cadastrar?

1. Conectar Carteira (Recomendado)
2. Continuar com E-mail

Responda com o número (por exemplo: 1)`,
    WALLET_CONNECTION: `Ótimo! Por favor conecte sua carteira para continuar.

Seu endereço de carteira será vinculado de forma segura ao seu perfil SI U. Isso permite que você acesse recursos exclusivos e reivindique seu nome SI U.

[O frontend exibirá as opções de conexão de carteira]`,
    WALLET_CONNECTED: `✅ Carteira conectada com sucesso!

Carteira: {walletAddress}`,
    WALLET_ALREADY_REGISTERED: `Este endereço de carteira já está registrado com outra conta. Por favor use uma carteira diferente ou continue com e-mail.`,
    SIU_NAME: `Agora vamos reivindicar seu nome SI U! 🏷️

Seu nome SI U é sua identidade única no ecossistema SI<3> (por exemplo, seunome.siu).

Qual nome SI U você gostaria de reivindicar?

Regras:
• 3-20 caracteres
• Apenas letras e números
• Não diferencia maiúsculas de minúsculas

Exemplo: Se você digitar "meunome", você terá meunome.siu`,
    SIU_NAME_INVALID: `Desculpe, esse nome SI U não é válido. Por favor escolha um nome que:
• Tenha 3-20 caracteres
• Contenha apenas letras e números (sem espaços ou caracteres especiais)

Tente novamente:`,
    SIU_NAME_TAKEN: `Desculpe, {siuName} já está em uso. Por favor escolha um nome diferente:`,
    SIU_NAME_CLAIMED: `🎉 Parabéns! Você reivindicou {siuName}!

Esta é sua identidade única no ecossistema SI<3>.`,
    SUMMARY_WALLET: `Carteira:`,
    SUMMARY_SIU_NAME: `Nome SI U:`,
    EDIT_WALLET: `Editar carteira`,
    EDIT_SIU_NAME: `Editar nome SI U`
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
    EMAIL: `Pour nous aider à connecter votre profil avec votre compte SI<3> Her et/ou Grow3dge, veuillez partager l'adresse e-mail avec laquelle vous vous êtes inscrit.

Quelle est votre adresse e-mail?`,
    PROFILE_EXISTS: `Nous avons trouvé un profil Agent Kaia existant connecté à cette adresse e-mail.`,
    PROFILE_CHOICE: `Souhaitez-vous:

1. Continuer avec votre profil existant
2. Créer un nouveau profil

Répondez avec le numéro (par exemple: 1)`,
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
2. Ventes, BD et Partenariats
3. Éducation 3.0
4. IA
5. Cybersécurité
6. DAOs
7. Tokenomics
8. Collecte de Fonds
9. DeepTech

Répondez avec le numéro avant le sujet (par exemple: 2,3). Si vous avez un sujet qui n'est pas dans la liste, tapez-le en texte (par exemple: 2,3 et DevRel)`,
    GOALS: `J'aimerais vous aider à trouver les bonnes connexions - que recherchez-vous? 🤝

1. Startups dans lesquelles investir
2. Investisseurs/programmes de subventions
3. Outils, stratégies et/ou support de croissance
4. Outils, stratégies et/ou support Ventes/BD
5. Communautés et/ou DAOs à rejoindre
6. Nouvelles opportunités d'emploi

Répondez avec le numéro avant le type de connexion (par exemple: 3, 4). Si vous avez un type de connexion qui n'est pas dans la liste, tapez-le en texte (par exemple 3,4 et Cybersécurité).`,
    EVENTS: `Je peux également vous connecter avec d'autres membres de Grow3dge qui assistent aux mêmes événements et conférences.

Pouvez-vous partager des événements auxquels vous assisterez prochainement (nom de l'événement, date et lieu)? (optionnel)

Pour passer à la question suivante, tapez 'Next'`,
    SOCIALS: `Pouvez-vous partager vos liens numériques et/ou profils de réseaux sociaux afin que nous puissions les partager avec vos correspondances? (optionnel)

Pour passer à la question suivante, tapez 'Next'`,
    TELEGRAM: `Quel est votre nom d'utilisateur Telegram pour que les membres avec lesquels vous vous connectez puissent vous contacter? (par exemple: @utilisateur)`,
    GENDER: `Nous sommes un écosystème qui valorise l'inclusion de groupes sous-représentés dans Web3. Nous menons des recherches de marché liées à l'industrie pour soutenir ces groupes à atteindre un accès plus équitable au financement, à la croissance et aux opportunités de carrière.

Si vous souhaitez être (anonymement) inclus dans notre recherche, veuillez dire Oui, Diversité et nous vous contacterons bientôt avec nos questions de recherche et nos politiques.

Pour passer à la question suivante, tapez 'Next'`,
    NOTIFICATIONS: `Une dernière chose... seriez-vous intéressé à recevoir des notifications pour les opportunités de collaboration de projets et de missions initiées par SI<3> et ses partenaires de l'écosystème?

1. Oui!
2. Non, merci
3. Pas encore sûr, contactez-moi à un autre moment

Veuillez répondre avec le numéro (par exemple: 1)`,
    COMPLETION: `Merci beaucoup pour votre inscription! 

Veuillez consulter votre profil de membre ici. À tout moment où vous souhaitez modifier ces données, tapez 'Edit Profile' et je vous aiderai à faire des mises à jour.

En attendant, je vous informerai lorsque j'aurai une correspondance de membre pour vous.`,
    COMPLETION_2: ``, // Deprecated - keeping for backwards compatibility
    SUMMARY_TITLE: `Voici votre résumé. Cela semble correct?`,
    SUMMARY_NAME: `Nom:`,
    SUMMARY_LOCATION: `Localisation:`,
    SUMMARY_EMAIL: `E-mail:`,
    SUMMARY_ROLES: `Rôles Professionnels:`,
    SUMMARY_INTERESTS: `Objectifs d'Apprentissage:`,
    SUMMARY_GOALS: `Objectifs de Connexion:`,
    SUMMARY_EVENTS: `Conférences auxquelles Vous Assisterez:`,
    SUMMARY_SOCIALS: `Liens Personnels:`,
    SUMMARY_TELEGRAM: `Nom d'Utilisateur Telegram:`,
    SUMMARY_GENDER: `Informations de Genre:`,
    SUMMARY_DIVERSITY: `Intérêt pour la Recherche sur la Diversité:`,
    SUMMARY_NOTIFICATIONS: `Notifications pour Collaborations:`,
    SUMMARY_NOT_PROVIDED: `Non fourni`,
    EDIT_NAME: `Modifier le nom`,
    EDIT_LOCATION: `Modifier la localisation`,
    EDIT_EMAIL: `Modifier l'e-mail`,
    EDIT_ROLES: `Modifier les rôles professionnels`,
    EDIT_INTERESTS: `Modifier les objectifs d'apprentissage`,
    EDIT_GOALS: `Modifier les objectifs de connexion`,
    EDIT_EVENTS: `Modifier les conférences auxquelles vous assisterez`,
    EDIT_SOCIALS: `Modifier les liens personnels`,
    EDIT_TELEGRAM: `Modifier le nom d'utilisateur Telegram`,
    EDIT_GENDER: `Modifier les informations de genre`,
    EDIT_NOTIFICATIONS: `Modifier les notifications pour collaborations`,
    CONFIRM: `✅ Confirmer`,
    NEXT_INSTRUCTION: `Pour passer à la question suivante, tapez 'Next'`,
    PROFILE_TITLE: `💜 Votre Profil Grow3dge:`,
    // NEW: SI U onboarding messages
    ENTRY_METHOD: `Bienvenue sur SI U! 🎉 Comment souhaitez-vous vous inscrire?

1. Connecter Portefeuille (Recommandé)
2. Continuer avec E-mail

Répondez avec le numéro (par exemple: 1)`,
    WALLET_CONNECTION: `Super! Veuillez connecter votre portefeuille pour continuer.

Votre adresse de portefeuille sera liée de manière sécurisée à votre profil SI U. Cela vous permet d'accéder aux fonctionnalités exclusives et de réclamer votre nom SI U.

[Le frontend affichera les options de connexion du portefeuille]`,
    WALLET_CONNECTED: `✅ Portefeuille connecté avec succès!

Portefeuille: {walletAddress}`,
    WALLET_ALREADY_REGISTERED: `Cette adresse de portefeuille est déjà enregistrée avec un autre compte. Veuillez utiliser un autre portefeuille ou continuer avec e-mail.`,
    SIU_NAME: `Maintenant réclamons votre nom SI U! 🏷️

Votre nom SI U est votre identité unique dans l'écosystème SI<3> (par exemple, votrenom.siu).

Quel nom SI U souhaitez-vous réclamer?

Règles:
• 3-20 caractères
• Lettres et chiffres uniquement
• Pas sensible à la casse

Exemple: Si vous tapez "monnom", vous obtiendrez monnom.siu`,
    SIU_NAME_INVALID: `Désolé, ce nom SI U n'est pas valide. Veuillez choisir un nom qui:
• A 3-20 caractères
• Contient uniquement des lettres et des chiffres (pas d'espaces ni de caractères spéciaux)

Réessayez:`,
    SIU_NAME_TAKEN: `Désolé, {siuName} est déjà pris. Veuillez choisir un autre nom:`,
    SIU_NAME_CLAIMED: `🎉 Félicitations! Vous avez réclamé {siuName}!

C'est votre identité unique dans l'écosystème SI<3>.`,
    SUMMARY_WALLET: `Portefeuille:`,
    SUMMARY_SIU_NAME: `Nom SI U:`,
    EDIT_WALLET: `Modifier le portefeuille`,
    EDIT_SIU_NAME: `Modifier le nom SI U`
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

/**
 * Get platform-specific messages based on user roles
 * Returns Grow3dge messages if user has "partner" role, SI Her if "team" role, default otherwise
 */
export function getPlatformMessages(lang: LanguageCode = 'en', roles: string[] = []): Messages {
  const baseMessages = getMessages(lang);
  const isGrow3dge = roles.includes('partner');
  const isSiHer = roles.includes('team');
  
  // If user has both roles, default to Grow3dge (can be changed if needed)
  if (isGrow3dge && !isSiHer) {
    return {
      ...baseMessages,
      INTERESTS: `As I am getting to know you better, can you please share what you are excited to explore in the Grow3dge program? You can select more than one topic.

1. Web3 Growth Marketing
2. Sales, BD & Partnerships
3. Education 3.0
4. AI
5. Cybersecurity
6. DAO's
7. Tokenomics
8. Fundraising
9. DeepTech

Reply with the number before the topic (for example: 2,3). If you have a topic that is not listed, type that as text (for example: 2,3 and DevRel)`,
      GOALS: `I'd love to help you find the right connections - what are you looking for? 🤝

1. Startups to invest in
2. Investors/grant programs
3. Growth tools, strategies, and/or support
4. Sales/BD tools, strategies and/or support
5. Communities and/or DAO's to join
6. New job opportunities

Reply with the number before the connection type (for example: 3, 4). If you have a connection type that is not listed, type that as text (for example 3,4 and Cybersecurity).`,
      EVENTS: `I am also able to match you with other Grow3dge members that are attending the same events and conferences.

Can you share any events that you will be attending coming up (event name, date, and location)? (optional)

To move on to the next question, type 'Next'`,
      SOCIALS: `Can you share your digital links and/or social media profiles so we can share those with your matches? (optional)

To move on to the next question, type 'Next'`,
      NOTIFICATIONS: `One last thing…would you be interested in receiving notifications for project and mission collaboration opportunities initiated by SI<3> and its ecosystem partners?

1. Yes!
2. No, thanks
3. Not sure yet, check in with me another time

Please reply with the number (for example: 1)`,
      PROFILE_TITLE: `💜 Your Grow3dge Profile:`
    };
  } else if (isSiHer && !isGrow3dge) {
    return {
      ...baseMessages,
      INTERESTS: `As I am getting to know you better, can you please share what you are excited to explore in our Si Her DAO? You can select more than one topic.

1. Personal Branding
2. Networking & Partnerships
3. Education 3.0 (peer-to-peer learning)
4. AI
5. Cybersecurity
6. DAO Education
7. Tokenomics
8. Fundraising
9. Well-Being

Reply with the number before the topic (for example: 2,3). If you have a topic that is not listed, type that as text (for example: 2,3 and xx)`,
      GOALS: `I'd love to help you find the right connections - what are you looking for? 🤝

1. Women in Web3 communities to join
2. Investors/grant programs
3. Well-Being support
4. New job opportunities
5. Technical projects to support as a developer
6. Si Her DAO members in my region

Reply with the number before the connection type (for example: 3, 4). If you have a connection type that is not listed, type that as text (for example 3,4 and xx).`,
      EVENTS: `I am also able to match you with other Si Her members that are attending the same events and conferences.

Can you share any events that you will be attending coming up (event name, date, and location)? (optional)

To move on to the next question, type 'Next'`,
      SOCIALS: `Can you share your digital links, siher.eth sites and/or social media profiles so we can share those with your matches? (optional)

To move on to the next question, type 'Next'`,
      NOTIFICATIONS: `One last thing…would you be interested in receiving notifications for project and mission collaboration opportunities initiated by SI<3> and Si Her DAO?

1. Yes!
2. No, thanks
3. Not sure yet, check in with me another time

Please reply with the number (for example: 1)`,
      PROFILE_TITLE: `💜 Your Si Her DAO Profile:`
    };
  } else if (isSiHer && isGrow3dge) {
    // User has BOTH roles - use generic/default questions (not tailored to either platform)
    return {
      ...baseMessages,
      PROFILE_TITLE: `💜 Your SI<3> Profile:`
    };
  }
  
  // Default (NEITHER platform detected) - use generic/default questions
  return {
    ...baseMessages,
    PROFILE_TITLE: `💜 Your SI<3> Profile:`
  };
}

