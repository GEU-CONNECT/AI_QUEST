const bcrypt = require('bcryptjs');
require('dotenv').config();
const prisma = require('../src/config/db');

const QUESTIONS_DATA = [
  {
    order: 1,
    questionText: "What does the term 'Deep Learning' primarily refer to in Artificial Intelligence?",
    options: [
      "Learning based on deep neural network architectures with multiple hidden layers",
      "Analyzing philosophical questions with computers",
      "Storing training datasets in deeply nested folder structures",
      "Translating human speech using relational databases"
    ],
    correctOptionIndex: 0,
    marks: 1.0,
    explanation: "Deep Learning utilizes artificial neural networks with multiple hidden layers between the input and output layers to model complex representations."
  },
  {
    order: 2,
    questionText: "Which activation function is most commonly used in modern deep neural networks to mitigate the vanishing gradient problem in hidden layers?",
    options: [
      "Sigmoid",
      "ReLU (Rectified Linear Unit)",
      "Step Function",
      "Linear Activation"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "ReLU (f(x) = max(0, x)) does not saturate for positive values, maintaining a constant derivative of 1 and avoiding vanishing gradients."
  },
  {
    order: 3,
    questionText: "In Python, which built-in data type is immutable?",
    options: [
      "List",
      "Dictionary",
      "Tuple",
      "Set"
    ],
    correctOptionIndex: 2,
    marks: 1.0,
    explanation: "Tuples in Python are immutable sequence data types; once created, their elements cannot be modified, appended, or deleted."
  },
  {
    order: 4,
    questionText: "Which architecture introduced the 'Self-Attention' mechanism that powers modern Large Language Models (LLMs) like GPT and Gemini?",
    options: [
      "Convolutional Neural Network (CNN)",
      "Recurrent Neural Network (RNN)",
      "Transformer Architecture",
      "Support Vector Machine (SVM)"
    ],
    correctOptionIndex: 2,
    marks: 1.0,
    explanation: "The Transformer architecture, introduced in the seminal 2017 paper 'Attention Is All You Need', replaced recurrence with multi-head self-attention mechanisms."
  },
  {
    order: 5,
    questionText: "What is the primary purpose of the 'validation set' during machine learning model training?",
    options: [
      "To update the weights and biases of the model via backpropagation",
      "To tune hyperparameters and detect overfitting without leaking test data",
      "To compress the model weights for edge deployment",
      "To format categorical features into one-hot encodings"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "The validation set is used to evaluate model performance across epochs, tune hyperparameters, and detect overfitting before final testing."
  },
  {
    order: 6,
    questionText: "What is the output of the following Python expression: `len({1, 2, 2, 3, 3, 3})`?",
    options: [
      "6",
      "3",
      "1",
      "Error: duplicate elements in set"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "A set in Python automatically eliminates duplicate elements. The set contains {1, 2, 3}, which has length 3."
  },
  {
    order: 7,
    questionText: "Which search algorithm is guaranteed to find the shortest path in an unweighted graph?",
    options: [
      "Depth-First Search (DFS)",
      "Breadth-First Search (BFS)",
      "Linear Search",
      "Genetic Algorithm"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "Breadth-First Search explores vertices level by level, ensuring that the first time a target vertex is reached, the path is shortest."
  },
  {
    order: 8,
    questionText: "In Computer Vision, which layer in a Convolutional Neural Network (CNN) reduces spatial dimensions while preserving dominant features?",
    options: [
      "Dense Layer",
      "Pooling Layer (e.g., MaxPooling)",
      "Dropout Layer",
      "Softmax Layer"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "Pooling layers (such as MaxPooling) downsample feature maps, reducing spatial resolution, computational cost, and translational sensitivity."
  },
  {
    order: 9,
    questionText: "What does NLP stand for in Artificial Intelligence?",
    options: [
      "Neural Logic Programming",
      "Natural Language Processing",
      "Network Layer Protocol",
      "Numeric Linear Prediction"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "NLP stands for Natural Language Processing, the subfield of AI concerned with giving computers the ability to understand human speech and text."
  },
  {
    order: 10,
    questionText: "Which of the following describes 'Overfitting' in supervised machine learning?",
    options: [
      "The model performs poorly on training data and well on unseen test data",
      "The model memorizes noise and specifics of training data, failing to generalize to new data",
      "The model has too few parameters to capture underlying trends",
      "The training loss increases while the learning rate remains zero"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "Overfitting occurs when a model models the training data too closely, capturing random noise rather than generalizable relationships."
  },
  {
    order: 11,
    questionText: "In Python, which keyword is used to handle exceptions gracefully?",
    options: [
      "catch",
      "except",
      "rescue",
      "handle"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "Python utilizes `try` and `except` blocks to catch and handle runtime exceptions."
  },
  {
    order: 12,
    questionText: "What type of learning paradigm does Q-learning belong to?",
    options: [
      "Supervised Learning",
      "Unsupervised Learning",
      "Reinforcement Learning",
      "Zero-Shot Learning"
    ],
    correctOptionIndex: 2,
    marks: 1.0,
    explanation: "Q-learning is a model-free reinforcement learning algorithm to learn the value of an action in a particular state based on environmental rewards."
  },
  {
    order: 13,
    questionText: "Which metric is most appropriate for evaluating a binary classification model when the dataset is heavily imbalanced (e.g., 99% negative, 1% positive)?",
    options: [
      "Raw Accuracy",
      "F1-Score / Precision-Recall AUC",
      "Mean Squared Error (MSE)",
      "R-squared"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "Raw accuracy is misleading on imbalanced datasets because a dummy model predicting the majority class achieves 99% accuracy; F1-score balances precision and recall on the minority class."
  },
  {
    order: 14,
    questionText: "What is the time complexity of searching for an element in a balanced Binary Search Tree (BST) with N nodes?",
    options: [
      "O(1)",
      "O(log N)",
      "O(N)",
      "O(N log N)"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "In a balanced BST, the height is logarithmic (log2 N), yielding O(log N) lookup time."
  },
  {
    order: 15,
    questionText: "Which company originally created and open-sourced the TensorFlow deep learning library?",
    options: [
      "Facebook (Meta)",
      "Google",
      "Microsoft",
      "Amazon AWS"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "TensorFlow was developed by the Google Brain team and released under the Apache 2.0 open-source license in November 2015."
  },
  {
    order: 16,
    questionText: "What does 'Tokenization' accomplish in Natural Language Processing?",
    options: [
      "Converting high-dimensional matrices into binary scalars",
      "Breaking raw text strings into discrete units like subwords, words, or characters",
      "Encrypting student passwords with cryptographic hashes",
      "Compressing PNG images without quality loss"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "Tokenization splits continuous text sequences into distinct atomic tokens that models can map to numerical embeddings."
  },
  {
    order: 17,
    questionText: "What will `bool([])` evaluate to in Python?",
    options: [
      "True",
      "False",
      "None",
      "Error: empty list cannot be cast to boolean"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "In Python, empty collections (empty lists, tuples, dicts, strings) evaluate to `False` in boolean contexts."
  },
  {
    order: 18,
    questionText: "Which of the following is an Unsupervised Learning algorithm?",
    options: [
      "Linear Regression",
      "Random Forest Classifier",
      "K-Means Clustering",
      "Logistic Regression"
    ],
    correctOptionIndex: 2,
    marks: 1.0,
    explanation: "K-Means is an unsupervised clustering algorithm that groups unlabeled data into K distinct clusters based on feature similarity."
  },
  {
    order: 19,
    questionText: "In computer systems, what is the function of the ALU (Arithmetic Logic Unit)?",
    options: [
      "Manage secondary storage memory allocation",
      "Perform elementary mathematical operations and logical comparisons",
      "Provide graphical output to the display monitor",
      "Convert analog audio signals to digital waveforms"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "The Arithmetic Logic Unit is a fundamental digital circuit within the CPU that executes arithmetic calculations and bitwise logical comparisons."
  },
  {
    order: 20,
    questionText: "What is the primary role of a 'Loss Function' in training neural networks?",
    options: [
      "To count the number of neurons in the architecture",
      "To measure the discrepancy between the model predictions and actual ground truth labels",
      "To increase the speed of disk reading",
      "To automatically visualize decision boundaries in 3D"
    ],
    correctOptionIndex: 1,
    marks: 1.0,
    explanation: "The loss function calculates a scalar penalty representing how far the network's predictions deviate from the true target values, guiding backpropagation."
  }
];

async function main() {
  console.log('--- Seeding AI Quest 2026 Event Database ---');

  // 1. Seed Super Admin — credentials from environment variables (NOT hardcoded)
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'AI Quest Chief Administrator';
  const superAdminMobile = process.env.SUPER_ADMIN_MOBILE || '9999999999';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@geu.ac.in';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminPassword) {
    console.error('❌ SUPER_ADMIN_PASSWORD environment variable is required for seeding!');
    console.error('   Set it in your .env file: SUPER_ADMIN_PASSWORD=your_secure_password');
    process.exit(1);
  }

  const adminPasswordHash = await bcrypt.hash(superAdminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { mobileNo: superAdminMobile },
    update: {
      name: superAdminName,
      role: 'ADMIN',
      email: superAdminEmail,
      passwordHash: adminPasswordHash
    },
    create: {
      registrationId: 'ADMIN-001',
      name: superAdminName,
      mobileNo: superAdminMobile,
      email: superAdminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      labNumber: 'MAIN-CONTROL'
    }
  });
  console.log(`✓ Super Admin seeded: ${admin.name} (Mobile: ${superAdminMobile})`);

  // 2. Seed 20 Sub-Admins for LAB-01 through LAB-20
  const subAdminPassHash = await bcrypt.hash('lab123', 10);
  for (let i = 1; i <= 20; i++) {
    const labPad = String(i).padStart(2, '0');
    const labNumber = `LAB-${labPad}`;
    const mobileNo = `98000000${labPad}`;
    const email = `lab${labPad}@geu.ac.in`;

    await prisma.user.upsert({
      where: { mobileNo },
      update: {
        name: `Invigilator ${labNumber}`,
        role: 'SUBADMIN',
        labNumber,
        passwordHash: subAdminPassHash
      },
      create: {
        registrationId: `SUBADMIN-${labPad}`,
        name: `Invigilator ${labNumber}`,
        mobileNo,
        email,
        passwordHash: subAdminPassHash,
        role: 'SUBADMIN',
        labNumber
      }
    });
  }
  console.log('✓ 20 Sub-Admins seeded for LAB-01 to LAB-20 (Pass: lab123)');

  // 3. Seed Default Proctoring Rule
  await prisma.proctoringRule.upsert({
    where: { id: 'default-proctoring-rule' },
    update: {
      maxTabSwitches: 3,
      violationAction: 'AUTO_LOCK',
      enforceFullscreen: true,
      showWarningModal: true
    },
    create: {
      id: 'default-proctoring-rule',
      maxTabSwitches: 3,
      violationAction: 'AUTO_LOCK',
      enforceFullscreen: true,
      showWarningModal: true,
      isCurrent: true
    }
  });
  console.log('✓ Default Proctoring Rules configured (3 tab switches -> AUTO_LOCK)');

  // 4. Seed Official AI Quest Assessment
  const existingQuiz = await prisma.quiz.findFirst({
    where: { title: 'AI Quest 2026 Grand Championship Assessment' }
  });

  let quizId = existingQuiz?.id;
  if (!existingQuiz) {
    const quiz = await prisma.quiz.create({
      data: {
        title: 'AI Quest 2026 Grand Championship Assessment',
        description: 'Official online assessment for Northern India premier technology and AI championship. 20 MCQs covering AI, Machine Learning, Python, and Logical Problem Solving.',
        durationMinutes: 30,
        totalMarks: 20.0,
        passingMarks: 8.0,
        negativeMarking: false,
        negativeMarksPerWrong: 0.25,
        accessCode: 'QUEST2026',
        isPasswordProtected: false,
        isPublished: true,
        isLive: true,
        showResultsAfterSubmit: true
      }
    });
    quizId = quiz.id;

    for (const q of QUESTIONS_DATA) {
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          order: q.order,
          questionText: q.questionText,
          options: JSON.stringify(q.options),
          correctOptionIndex: q.correctOptionIndex,
          marks: q.marks,
          explanation: q.explanation
        }
      });
    }
    console.log(`✓ Official Quiz Created with ${QUESTIONS_DATA.length} Questions (ID: ${quiz.id})`);
  } else {
    console.log(`✓ Official Quiz already present (ID: ${existingQuiz.id})`);
  }

  // 5. Seed sample students ONLY if explicitly requested via SEED_SAMPLE_STUDENTS=true
  if (process.env.SEED_SAMPLE_STUDENTS === 'true') {
    const sampleStudents = [
      {
        name: 'Pragya Karnwal',
        mobileNo: '9812345678',
        email: 'pragya.karnwal@gmail.com',
        studentClass: 'Class 12th',
        stream: 'Science (PCM)',
        schoolName: 'Doon International School, Dehradun',
        parentName: 'Rajesh Karnwal',
        parentContact: '9812345670',
        city: 'Dehradun',
        labNumber: 'LAB-01'
      },
      {
        name: 'Aarav Sharma',
        mobileNo: '9876543210',
        email: 'aarav.sharma@gmail.com',
        studentClass: 'Class 12th',
        stream: 'Science (PCM)',
        schoolName: "St. Joseph's Academy, Dehradun",
        parentName: 'Vikram Sharma',
        parentContact: '9876543219',
        city: 'Dehradun',
        labNumber: 'LAB-01'
      },
      {
        name: 'Ananya Joshi',
        mobileNo: '9833445566',
        email: 'ananya.joshi@gmail.com',
        studentClass: 'Class 11th',
        stream: 'Science (PCB)',
        schoolName: 'Graphic Era Global School, Dehradun',
        parentName: 'Sunil Joshi',
        parentContact: '9833445560',
        city: 'Dehradun',
        labNumber: 'LAB-02'
      }
    ];

    const studentPass = await bcrypt.hash('1234', 10);
    for (let sIdx = 0; sIdx < sampleStudents.length; sIdx++) {
      const s = sampleStudents[sIdx];
      const regId = `GEU-AIQ-2026-1000${sIdx + 1}`;
      await prisma.user.upsert({
        where: { mobileNo: s.mobileNo },
        update: {},
        create: {
          registrationId: regId,
          name: s.name,
          mobileNo: s.mobileNo,
          email: s.email,
          passwordHash: studentPass,
          role: 'STUDENT',
          studentClass: s.studentClass,
          stream: s.stream,
          schoolName: s.schoolName,
          parentName: s.parentName,
          parentContact: s.parentContact,
          city: s.city,
          labNumber: s.labNumber
        }
      });
    }
    console.log(`✓ ${sampleStudents.length} sample candidates seeded (PIN: 1234)`);
  } else {
    console.log('✓ Clean slate: No sample students seeded. Student database remains 100% clean for live registrations.');
  }
  console.log('--- Seeding Complete Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
