(() => {
  'use strict';
  const KEY = 'tezz-connect-language';
  // The manifest is the single source of truth for enabled locales.
  // Add a locale there when its reviewed translation bundle is ready.
  let languages = [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
    { code: 'hi', name: 'हिन्दी', nativeName: 'हिन्दी', direction: 'ltr' },
    { code: 'mr', name: 'मराठी', nativeName: 'मराठी', direction: 'ltr' },
    { code: 'bn', name: 'বাংলা', nativeName: 'বাংলা', direction: 'ltr' }
  ];
  let supported = new Set(languages.map(item => item.code));
  let directions = new Map(languages.map(item => [item.code, item.direction || 'ltr']));
  const copy = {
    hi: {
      'Understand your internet.':'अपने इंटरनेट को समझें।',
      'Make every connection better.':'हर कनेक्शन को बेहतर बनाएँ।',
      'Clear, practical knowledge for everyday internet users—from understanding speed and fixing Wi-Fi problems to choosing the right networking equipment.':'रोज़मर्रा के इंटरनेट उपयोगकर्ताओं के लिए सरल और उपयोगी जानकारी—इंटरनेट की गति समझने, वाई-फ़ाई की समस्याएँ ठीक करने और सही नेटवर्क उपकरण चुनने तक।',
      'Test your internet connection':'अपने इंटरनेट कनेक्शन की जाँच करें',
      'Explore the knowledge hub ↓':'ज्ञान केंद्र देखें ↓',
      'Practical explanations':'व्यावहारिक जानकारी',
      'Independent learning':'स्वयं सीखें',
      'Useful troubleshooting':'समस्या हल करने के उपयोगी तरीके',
      'Not sure where to begin? Follow the Internet Learning Roadmap.':'कहाँ से शुरू करें, समझ नहीं आ रहा? इंटरनेट लर्निंग रोडमैप अपनाएँ।',
      'One clear journey through internet basics, speed, Wi-Fi troubleshooting and network performance—with practical activities at every level.':'इंटरनेट की बुनियादी जानकारी, गति, वाई-फ़ाई समस्या समाधान और नेटवर्क प्रदर्शन को समझने की क्रमबद्ध यात्रा—हर स्तर पर व्यावहारिक गतिविधियों के साथ।',
      'Start the learning roadmap →':'लर्निंग रोडमैप शुरू करें →',
      'EXPLORE BY TOPIC':'विषय के अनुसार देखें',
      'What do you want to understand?':'आप क्या समझना चाहते हैं?',
      'Start with a topic. Each collection brings related guides together so you can find the right answer faster.':'किसी विषय से शुरुआत करें। हर संग्रह में उससे जुड़ी गाइड हैं, ताकि आप सही जानकारी जल्दी पा सकें।',
      'How the internet works':'इंटरनेट कैसे काम करता है',
      'Follow a website request from your device through your router, provider and server—and back.':'अपने डिवाइस से राउटर, इंटरनेट सेवा प्रदाता और सर्वर तक वेबसाइट अनुरोध की यात्रा समझें।',
      'Follow the network journey →':'नेटवर्क की यात्रा देखें →',
      'Internet fundamentals':'इंटरनेट की बुनियादी बातें',
      'Understand how the internet, your devices, router and service provider work together.':'जानें कि इंटरनेट, आपके डिवाइस, राउटर और सेवा प्रदाता मिलकर कैसे काम करते हैं।',
      'Learn the basics →':'बुनियादी बातें सीखें →',
      'Speed & bandwidth':'गति और बैंडविड्थ',
      'Download speed, upload speed, Mbps and what your activities actually need.':'डाउनलोड गति, अपलोड गति, Mbps और आपके कामों के लिए वास्तव में कितनी गति चाहिए।',
      'Explore speed →':'गति को समझें →',
      'Signals & performance':'सिग्नल और प्रदर्शन',
      'Latency, ping, jitter and the factors behind a responsive connection.':'लेटेंसी, पिंग, जिटर और तेज़ प्रतिक्रिया देने वाले कनेक्शन को प्रभावित करने वाले कारक।',
      'Understand performance →':'प्रदर्शन समझें →',
      'Wi-Fi signal simulator':'वाई-फ़ाई सिग्नल सिम्युलेटर',
      'Move a virtual router, change wall conditions and explore how Wi-Fi coverage can vary across a home.':'वर्चुअल राउटर की जगह और दीवारों की स्थिति बदलकर देखें कि घर में वाई-फ़ाई कवरेज कैसे बदलता है।',
      'Explore signal coverage →':'सिग्नल कवरेज देखें →',
      'Wi-Fi & troubleshooting':'वाई-फ़ाई और समस्या समाधान',
      'Improve coverage, find common Wi-Fi problems and work through practical checks.':'कवरेज बेहतर करें, आम वाई-फ़ाई समस्याएँ पहचानें और व्यावहारिक जाँच करें।',
      'Fix Wi-Fi issues →':'वाई-फ़ाई समस्याएँ ठीक करें →',
      'Networking equipment':'नेटवर्किंग उपकरण',
      'Learn about routers, mesh systems, extenders, Ethernet cables and switches.':'राउटर, मेश सिस्टम, एक्सटेंडर, ईथरनेट केबल और स्विच के बारे में जानें।',
      'Explore buying guides →':'खरीदारी गाइड देखें →',
      'Home network planner':'होम नेटवर्क प्लानर',
      'Plan a practical router, mesh, access-point and Ethernet layout for your home.':'अपने घर के लिए राउटर, मेश, एक्सेस पॉइंट और ईथरनेट का उपयोगी लेआउट बनाएँ।',
      'Build your network plan →':'अपना नेटवर्क प्लान बनाएँ →',
      'Wi-Fi security checkup':'वाई-फ़ाई सुरक्षा जाँच',
      'Review router encryption, passwords, updates, guest access and safer settings.':'राउटर एन्क्रिप्शन, पासवर्ड, अपडेट, गेस्ट एक्सेस और सुरक्षित सेटिंग्स की जाँच करें।',
      'Check Wi-Fi security →':'वाई-फ़ाई सुरक्षा जाँचें →',
      'Networking glossary':'नेटवर्किंग शब्दावली',
      'Search 24 plain-English explanations of internet, Wi-Fi and network terms.':'इंटरनेट, वाई-फ़ाई और नेटवर्क के 24 शब्दों की सरल व्याख्या खोजें।',
      'Explore the glossary →':'शब्दावली देखें →',
      'Internet for everyday use':'रोज़मर्रा के कामों के लिए इंटरनेट',
      'Explore gaming latency, jitter and packet loss with a hands-on network learning lab.':'व्यावहारिक नेटवर्क लर्निंग लैब में गेमिंग लेटेंसी, जिटर और पैकेट लॉस समझें।',
      'Try the gaming network lab →':'गेमिंग नेटवर्क लैब आज़माएँ →',
      'Connection troubleshooter':'कनेक्शन समस्या समाधान',
      'Choose a symptom and get a practical checklist for slow internet, weak Wi-Fi, lag and dropouts.':'लक्षण चुनें और धीमे इंटरनेट, कमज़ोर वाई-फ़ाई, लैग और बार-बार कनेक्शन टूटने के लिए उपयोगी चेकलिस्ट पाएँ।',
      'Build a troubleshooting plan →':'समस्या समाधान योजना बनाएँ →',
      'Interactive network lab':'इंटरैक्टिव नेटवर्क लैब',
      'Change Wi-Fi, latency and home network conditions to see how connections behave.':'वाई-फ़ाई, लेटेंसी और घरेलू नेटवर्क की स्थितियाँ बदलकर देखें कि कनेक्शन कैसे काम करता है।',
      'Try the simulations →':'सिम्युलेशन आज़माएँ →',
      'LEARN AT YOUR PACE':'अपनी गति से सीखें',
      'Explore the guides':'गाइड देखें',
      'Focused explainers to help you understand a topic and take the next practical step.':'किसी विषय को समझने और अगला व्यावहारिक कदम उठाने में मदद करने वाली गाइड।',
      'Find a guide':'गाइड खोजें',
      'Search Wi-Fi, ping, gaming, Mbps…':'वाई-फ़ाई, पिंग, गेमिंग, Mbps खोजें…',
      'All topics':'सभी विषय',
      'Internet basics':'इंटरनेट की बुनियादी बातें',
      'Performance':'प्रदर्शन',
      'Equipment':'उपकरण',
      'Everyday use':'रोज़मर्रा का उपयोग',
      'Interactive labs':'इंटरैक्टिव लैब',
      'Troubleshooting':'समस्या समाधान',
      'Clear':'हटाएँ'
    },
    mr: {
      'Understand your internet.':'तुमचे इंटरनेट समजून घ्या.',
      'Make every connection better.':'प्रत्येक कनेक्शन अधिक चांगले बनवा.',
      'Clear, practical knowledge for everyday internet users—from understanding speed and fixing Wi-Fi problems to choosing the right networking equipment.':'दररोज इंटरनेट वापरणाऱ्यांसाठी सोपी आणि उपयुक्त माहिती—वेग समजून घेण्यापासून वाय-फाय समस्या सोडवणे आणि योग्य नेटवर्क उपकरणे निवडण्यापर्यंत.',
      'Test your internet connection':'तुमचे इंटरनेट कनेक्शन तपासा',
      'Explore the knowledge hub ↓':'ज्ञान केंद्र पाहा ↓',
      'Practical explanations':'उपयुक्त स्पष्टीकरणे',
      'Independent learning':'स्वतः शिकणे',
      'Useful troubleshooting':'समस्या सोडवण्याचे मार्ग',
      'Not sure where to begin? Follow the Internet Learning Roadmap.':'कुठून सुरुवात करावी हे समजत नाही? इंटरनेट लर्निंग रोडमॅप वापरा.',
      'One clear journey through internet basics, speed, Wi-Fi troubleshooting and network performance—with practical activities at every level.':'इंटरनेटची मूलतत्त्वे, वेग, वाय-फाय समस्या निवारण आणि नेटवर्क कार्यक्षमता यांचा प्रत्येक टप्प्यावर कृतींसह सोपा प्रवास.',
      'Start the learning roadmap →':'शिकण्याचा रोडमॅप सुरू करा →',
      'EXPLORE BY TOPIC':'विषयानुसार पाहा',
      'What do you want to understand?':'तुम्हाला काय समजून घ्यायचे आहे?',
      'Start with a topic. Each collection brings related guides together so you can find the right answer faster.':'एखाद्या विषयापासून सुरुवात करा. प्रत्येक संग्रहात संबंधित मार्गदर्शिका एकत्र आहेत, त्यामुळे योग्य उत्तर लवकर मिळेल.',
      'How the internet works':'इंटरनेट कसे कार्य करते',
      'Follow a website request from your device through your router, provider and server—and back.':'तुमच्या डिव्हाइसपासून राउटर, सेवा प्रदाता आणि सर्व्हरपर्यंत वेबसाइट विनंतीचा प्रवास समजून घ्या.',
      'Follow the network journey →':'नेटवर्कचा प्रवास पाहा →',
      'Internet fundamentals':'इंटरनेटची मूलतत्त्वे',
      'Understand how the internet, your devices, router and service provider work together.':'इंटरनेट, तुमची उपकरणे, राउटर आणि सेवा प्रदाता एकत्र कसे काम करतात ते समजून घ्या.',
      'Learn the basics →':'मूलतत्त्वे शिका →',
      'Speed & bandwidth':'वेग आणि बँडविड्थ',
      'Download speed, upload speed, Mbps and what your activities actually need.':'डाउनलोड वेग, अपलोड वेग, Mbps आणि तुमच्या कामांसाठी प्रत्यक्षात किती वेग हवा.',
      'Explore speed →':'वेग समजून घ्या →',
      'Signals & performance':'सिग्नल आणि कार्यक्षमता',
      'Latency, ping, jitter and the factors behind a responsive connection.':'लेटन्सी, पिंग, जिटर आणि जलद प्रतिसाद देणाऱ्या कनेक्शनवर परिणाम करणारे घटक.',
      'Understand performance →':'कार्यक्षमता समजून घ्या →',
      'Wi-Fi signal simulator':'वाय-फाय सिग्नल सिम्युलेटर',
      'Move a virtual router, change wall conditions and explore how Wi-Fi coverage can vary across a home.':'व्हर्च्युअल राउटरची जागा आणि भिंतींची स्थिती बदलून घरातील वाय-फाय कव्हरेज कसे बदलते ते पाहा.',
      'Explore signal coverage →':'सिग्नल कव्हरेज पाहा →',
      'Wi-Fi & troubleshooting':'वाय-फाय आणि समस्या निवारण',
      'Improve coverage, find common Wi-Fi problems and work through practical checks.':'कव्हरेज सुधारा, सामान्य वाय-फाय समस्या ओळखा आणि उपयुक्त तपासण्या करा.',
      'Fix Wi-Fi issues →':'वाय-फाय समस्या सोडवा →',
      'Networking equipment':'नेटवर्किंग उपकरणे',
      'Learn about routers, mesh systems, extenders, Ethernet cables and switches.':'राउटर, मेश सिस्टीम, एक्स्टेंडर, इथरनेट केबल आणि स्विच यांची माहिती घ्या.',
      'Explore buying guides →':'खरेदी मार्गदर्शिका पाहा →',
      'Home network planner':'होम नेटवर्क प्लॅनर',
      'Plan a practical router, mesh, access-point and Ethernet layout for your home.':'तुमच्या घरासाठी राउटर, मेश, ॲक्सेस पॉइंट आणि इथरनेटची उपयुक्त मांडणी ठरवा.',
      'Build your network plan →':'तुमचा नेटवर्क आराखडा तयार करा →',
      'Wi-Fi security checkup':'वाय-फाय सुरक्षा तपासणी',
      'Review router encryption, passwords, updates, guest access and safer settings.':'राउटर एन्क्रिप्शन, पासवर्ड, अपडेट, गेस्ट ॲक्सेस आणि सुरक्षित सेटिंग्ज तपासा.',
      'Check Wi-Fi security →':'वाय-फाय सुरक्षा तपासा →',
      'Networking glossary':'नेटवर्किंग शब्दकोश',
      'Search 24 plain-English explanations of internet, Wi-Fi and network terms.':'इंटरनेट, वाय-फाय आणि नेटवर्कमधील २४ संज्ञांची सोपी स्पष्टीकरणे शोधा.',
      'Explore the glossary →':'शब्दकोश पाहा →',
      'Internet for everyday use':'दैनंदिन वापरासाठी इंटरनेट',
      'Explore gaming latency, jitter and packet loss with a hands-on network learning lab.':'प्रत्यक्ष नेटवर्क लर्निंग लॅबमध्ये गेमिंग लेटन्सी, जिटर आणि पॅकेट लॉस समजून घ्या.',
      'Try the gaming network lab →':'गेमिंग नेटवर्क लॅब वापरून पाहा →',
      'Connection troubleshooter':'कनेक्शन समस्या निवारक',
      'Choose a symptom and get a practical checklist for slow internet, weak Wi-Fi, lag and dropouts.':'लक्षण निवडा आणि मंद इंटरनेट, कमकुवत वाय-फाय, लॅग व कनेक्शन तुटण्यासाठी उपयुक्त तपासणी यादी मिळवा.',
      'Build a troubleshooting plan →':'समस्या निवारण योजना तयार करा →',
      'Interactive network lab':'इंटरॅक्टिव्ह नेटवर्क लॅब',
      'Change Wi-Fi, latency and home network conditions to see how connections behave.':'वाय-फाय, लेटन्सी आणि घरच्या नेटवर्कच्या परिस्थिती बदलून कनेक्शन कसे वागते ते पाहा.',
      'Try the simulations →':'सिम्युलेशन वापरून पाहा →',
      'LEARN AT YOUR PACE':'तुमच्या गतीने शिका',
      'Explore the guides':'मार्गदर्शिका पाहा',
      'Focused explainers to help you understand a topic and take the next practical step.':'विषय समजून घेण्यासाठी आणि पुढचे उपयुक्त पाऊल उचलण्यासाठी सोपी स्पष्टीकरणे.',
      'Find a guide':'मार्गदर्शिका शोधा',
      'Search Wi-Fi, ping, gaming, Mbps…':'वाय-फाय, पिंग, गेमिंग, Mbps शोधा…',
      'All topics':'सर्व विषय',
      'Internet basics':'इंटरनेटची मूलतत्त्वे',
      'Performance':'कार्यक्षमता',
      'Equipment':'उपकरणे',
      'Everyday use':'दैनंदिन वापर',
      'Interactive labs':'इंटरॅक्टिव्ह लॅब',
      'Troubleshooting':'समस्या निवारण',
      'Clear':'पुसून टाका'
    },
    bn: {
      'Understand your internet.':'আপনার ইন্টারনেট বুঝুন।',
      'Make every connection better.':'প্রতিটি সংযোগ আরও ভালো করুন।',
      'Clear, practical knowledge for everyday internet users—from understanding speed and fixing Wi-Fi problems to choosing the right networking equipment.':'প্রতিদিনের ইন্টারনেট ব্যবহারকারীদের জন্য সহজ ও কার্যকর তথ্য—গতি বোঝা, ওয়াই-ফাই সমস্যা সমাধান এবং সঠিক নেটওয়ার্ক সরঞ্জাম বেছে নেওয়া পর্যন্ত।',
      'Test your internet connection':'আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন',
      'Explore the knowledge hub ↓':'জ্ঞানকেন্দ্র দেখুন ↓',
      'Practical explanations':'ব্যবহারিক ব্যাখ্যা',
      'Independent learning':'নিজে নিজে শিখুন',
      'Useful troubleshooting':'সমস্যা সমাধানের উপায়',
      'Not sure where to begin? Follow the Internet Learning Roadmap.':'কোথা থেকে শুরু করবেন বুঝতে পারছেন না? ইন্টারনেট লার্নিং রোডম্যাপ অনুসরণ করুন।',
      'One clear journey through internet basics, speed, Wi-Fi troubleshooting and network performance—with practical activities at every level.':'ইন্টারনেটের মূল বিষয়, গতি, ওয়াই-ফাই সমস্যা সমাধান এবং নেটওয়ার্ক কর্মক্ষমতা শেখার একটি সহজ পথ—প্রতিটি স্তরে ব্যবহারিক কাজসহ।',
      'Start the learning roadmap →':'লার্নিং রোডম্যাপ শুরু করুন →',
      'EXPLORE BY TOPIC':'বিষয় অনুযায়ী দেখুন',
      'What do you want to understand?':'আপনি কী বুঝতে চান?',
      'Start with a topic. Each collection brings related guides together so you can find the right answer faster.':'একটি বিষয় দিয়ে শুরু করুন। প্রতিটি সংগ্রহে সম্পর্কিত গাইড একসঙ্গে রয়েছে, যাতে দ্রুত সঠিক উত্তর খুঁজে পান।',
      'How the internet works':'ইন্টারনেট কীভাবে কাজ করে',
      'Follow a website request from your device through your router, provider and server—and back.':'আপনার ডিভাইস থেকে রাউটার, পরিষেবা প্রদানকারী ও সার্ভার পর্যন্ত ওয়েবসাইট অনুরোধের যাত্রা বুঝুন।',
      'Follow the network journey →':'নেটওয়ার্কের যাত্রা দেখুন →',
      'Internet fundamentals':'ইন্টারনেটের মূল বিষয়',
      'Understand how the internet, your devices, router and service provider work together.':'ইন্টারনেট, আপনার ডিভাইস, রাউটার ও পরিষেবা প্রদানকারী কীভাবে একসঙ্গে কাজ করে তা জানুন।',
      'Learn the basics →':'মূল বিষয় শিখুন →',
      'Speed & bandwidth':'গতি ও ব্যান্ডউইথ',
      'Download speed, upload speed, Mbps and what your activities actually need.':'ডাউনলোড গতি, আপলোড গতি, Mbps এবং আপনার কাজের জন্য আসলে কত গতি দরকার।',
      'Explore speed →':'গতি বুঝুন →',
      'Signals & performance':'সিগন্যাল ও কর্মক্ষমতা',
      'Latency, ping, jitter and the factors behind a responsive connection.':'লেটেন্সি, পিং, জিটার এবং দ্রুত প্রতিক্রিয়াশীল সংযোগের পেছনের কারণগুলি জানুন।',
      'Understand performance →':'কর্মক্ষমতা বুঝুন →',
      'Wi-Fi signal simulator':'ওয়াই-ফাই সিগন্যাল সিমুলেটর',
      'Move a virtual router, change wall conditions and explore how Wi-Fi coverage can vary across a home.':'ভার্চুয়াল রাউটারের অবস্থান ও দেয়ালের পরিস্থিতি বদলে বাড়িতে ওয়াই-ফাই কভারেজ কীভাবে বদলায় দেখুন।',
      'Explore signal coverage →':'সিগন্যাল কভারেজ দেখুন →',
      'Wi-Fi & troubleshooting':'ওয়াই-ফাই ও সমস্যা সমাধান',
      'Improve coverage, find common Wi-Fi problems and work through practical checks.':'কভারেজ উন্নত করুন, সাধারণ ওয়াই-ফাই সমস্যা খুঁজুন এবং ব্যবহারিক পরীক্ষা করুন।',
      'Fix Wi-Fi issues →':'ওয়াই-ফাই সমস্যা ঠিক করুন →',
      'Networking equipment':'নেটওয়ার্ক সরঞ্জাম',
      'Learn about routers, mesh systems, extenders, Ethernet cables and switches.':'রাউটার, মেশ সিস্টেম, এক্সটেন্ডার, ইথারনেট কেবল ও সুইচ সম্পর্কে জানুন।',
      'Explore buying guides →':'কেনাকাটার গাইড দেখুন →',
      'Home network planner':'হোম নেটওয়ার্ক প্ল্যানার',
      'Plan a practical router, mesh, access-point and Ethernet layout for your home.':'আপনার বাড়ির জন্য রাউটার, মেশ, অ্যাক্সেস পয়েন্ট ও ইথারনেটের ব্যবহারিক বিন্যাস পরিকল্পনা করুন।',
      'Build your network plan →':'আপনার নেটওয়ার্ক পরিকল্পনা তৈরি করুন →',
      'Wi-Fi security checkup':'ওয়াই-ফাই নিরাপত্তা পরীক্ষা',
      'Review router encryption, passwords, updates, guest access and safer settings.':'রাউটার এনক্রিপশন, পাসওয়ার্ড, আপডেট, অতিথি অ্যাক্সেস ও নিরাপদ সেটিংস পর্যালোচনা করুন।',
      'Check Wi-Fi security →':'ওয়াই-ফাই নিরাপত্তা পরীক্ষা করুন →',
      'Networking glossary':'নেটওয়ার্কিং শব্দকোষ',
      'Search 24 plain-English explanations of internet, Wi-Fi and network terms.':'ইন্টারনেট, ওয়াই-ফাই ও নেটওয়ার্কের ২৪টি শব্দের সহজ ব্যাখ্যা খুঁজুন।',
      'Explore the glossary →':'শব্দকোষ দেখুন →',
      'Internet for everyday use':'দৈনন্দিন ব্যবহারের ইন্টারনেট',
      'Explore gaming latency, jitter and packet loss with a hands-on network learning lab.':'হাতে-কলমে নেটওয়ার্ক লার্নিং ল্যাবে গেমিং লেটেন্সি, জিটার ও প্যাকেট লস বুঝুন।',
      'Try the gaming network lab →':'গেমিং নেটওয়ার্ক ল্যাব ব্যবহার করুন →',
      'Connection troubleshooter':'সংযোগ সমস্যা সমাধানকারী',
      'Choose a symptom and get a practical checklist for slow internet, weak Wi-Fi, lag and dropouts.':'লক্ষণ বেছে নিয়ে ধীর ইন্টারনেট, দুর্বল ওয়াই-ফাই, ল্যাগ ও সংযোগ বিচ্ছিন্নতার জন্য ব্যবহারিক তালিকা পান।',
      'Build a troubleshooting plan →':'সমস্যা সমাধানের পরিকল্পনা তৈরি করুন →',
      'Interactive network lab':'ইন্টারঅ্যাকটিভ নেটওয়ার্ক ল্যাব',
      'Change Wi-Fi, latency and home network conditions to see how connections behave.':'ওয়াই-ফাই, লেটেন্সি ও হোম নেটওয়ার্কের পরিস্থিতি বদলে সংযোগের আচরণ দেখুন।',
      'Try the simulations →':'সিমুলেশন ব্যবহার করুন →',
      'LEARN AT YOUR PACE':'নিজের গতিতে শিখুন',
      'Explore the guides':'গাইড দেখুন',
      'Focused explainers to help you understand a topic and take the next practical step.':'কোনো বিষয় বুঝতে এবং পরবর্তী ব্যবহারিক পদক্ষেপ নিতে সাহায্যকারী সহজ ব্যাখ্যা।',
      'Find a guide':'একটি গাইড খুঁজুন',
      'Search Wi-Fi, ping, gaming, Mbps…':'ওয়াই-ফাই, পিং, গেমিং, Mbps খুঁজুন…',
      'All topics':'সব বিষয়',
      'Internet basics':'ইন্টারনেটের মূল বিষয়',
      'Performance':'কর্মক্ষমতা',
      'Equipment':'সরঞ্জাম',
      'Everyday use':'দৈনন্দিন ব্যবহার',
      'Interactive labs':'ইন্টারঅ্যাকটিভ ল্যাব',
      'Troubleshooting':'সমস্যা সমাধান',
      'Clear':'মুছুন'
    }
  };
  Object.assign(copy.hi, {"In this guide":"इस गाइड में","Keep learning":"आगे सीखें","Try it yourself":"खुद करके देखें","What does internet speed actually mean?":"इंटरनेट की गति का वास्तव में क्या मतलब है?","Download speed and upload speed: what’s the difference?":"डाउनलोड और अपलोड गति में क्या अंतर है?","Download speed and upload speed: what's the difference?":"डाउनलोड और अपलोड गति में क्या अंतर है?","How much speed do you need?":"आपको कितनी इंटरनेट गति चाहिए?","How much internet speed might your home need?":"आपके घर को कितनी इंटरनेट गति की आवश्यकता हो सकती है?","How long will a download or upload take?":"डाउनलोड या अपलोड में कितना समय लगेगा?","How to get a useful speed-test result":"उपयोगी स्पीड टेस्ट परिणाम कैसे पाएँ","How to read your internet speed test results":"अपने इंटरनेट स्पीड टेस्ट के परिणाम कैसे समझें","Download and upload: look at both directions":"डाउनलोड और अपलोड—दोनों दिशाओं को देखें","Latency: how quickly does a response come back?":"लेटेंसी: जवाब कितनी जल्दी वापस आता है?","Jitter and packet loss: is the connection consistent?":"जिटर और पैकेट लॉस: क्या कनेक्शन स्थिर है?","Why one test may show a different result from another":"अलग-अलग टेस्ट में अलग परिणाम क्यों आ सकते हैं?","Does a faster internet plan always make everything faster?":"क्या तेज़ इंटरनेट प्लान से हर चीज़ तेज़ हो जाती है?","Bandwidth, speed and performance are related—but not identical":"बैंडविड्थ, गति और प्रदर्शन जुड़े हैं—लेकिन एक जैसे नहीं हैं","Frequently asked questions about internet speed":"इंटरनेट गति के बारे में अक्सर पूछे जाने वाले सवाल","What TEZZ CONNECT measures":"TEZZ CONNECT क्या मापता है","Check your connection":"अपना कनेक्शन जाँचें","Common questions about internet speed":"इंटरनेट गति से जुड़े आम सवाल","Is 100 Mbps the same as 100 MB per second?":"क्या 100 Mbps, 100 MB प्रति सेकंड के बराबर है?","Why does my download speed change during the day?":"दिन में मेरी डाउनलोड गति क्यों बदलती रहती है?","Will a faster plan fix buffering?":"क्या तेज़ प्लान से बफरिंग ठीक हो जाएगी?","Why is my speed test good but one website slow?":"स्पीड टेस्ट अच्छा है, फिर भी कोई वेबसाइट धीमी क्यों है?","How many speed tests should I run?":"मुझे कितने स्पीड टेस्ट करने चाहिए?","Should I choose my internet plan based only on download speed?":"क्या केवल डाउनलोड गति देखकर इंटरनेट प्लान चुनना चाहिए?","Is 100 Mbps fast enough for a family?":"क्या परिवार के लिए 100 Mbps पर्याप्त तेज़ है?","Why is my download speed lower than my internet plan?":"मेरी डाउनलोड गति मेरे इंटरनेट प्लान से कम क्यों है?","Does upload speed matter?":"क्या अपलोड गति मायने रखती है?","Are Mbps and MB/s the same?":"क्या Mbps और MB/s एक ही हैं?","What is latency?":"लेटेंसी क्या है?","What does ping mean?":"पिंग का क्या मतलब है?","What is jitter?":"जिटर क्या है?","Why do these numbers matter?":"ये आँकड़े क्यों मायने रखते हैं?","See how delay, jitter and packet loss change a connection":"देखें कि देरी, जिटर और पैकेट लॉस कनेक्शन को कैसे बदलते हैं","What can you do if response times are high?":"अगर प्रतिक्रिया समय अधिक हो तो आप क्या कर सकते हैं?","Why a fast internet plan can still feel slow":"तेज़ इंटरनेट प्लान भी धीमा क्यों महसूस हो सकता है","Four common reasons for high ping or unstable jitter":"उच्च पिंग या अस्थिर जिटर के चार आम कारण","1. Wi-Fi interference or a weak signal":"1. वाई-फ़ाई में रुकावट या कमज़ोर सिग्नल","2. A busy connection (sometimes called bufferbloat)":"2. व्यस्त कनेक्शन (जिसे कभी-कभी बफरब्लोट कहते हैं)","3. Distance and the route to the service":"3. दूरी और सेवा तक पहुँचने का नेटवर्क मार्ग","4. Congestion beyond your home":"4. आपके घर के बाहर नेटवर्क में भीड़","A simple way to isolate the source of the delay":"देरी का स्रोत पहचानने का आसान तरीका","What counts as good latency or jitter?":"अच्छी लेटेंसी या जिटर किसे माना जाता है?","Frequently asked questions about ping and jitter":"पिंग और जिटर के बारे में अक्सर पूछे जाने वाले सवाल","Is ping the same as latency?":"क्या पिंग और लेटेंसी एक ही हैं?","Can I have high download speed but high ping?":"क्या डाउनलोड गति अधिक होने पर भी पिंग अधिक हो सकता है?","Does jitter matter more than ping?":"क्या जिटर, पिंग से अधिक मायने रखता है?","Will changing DNS reduce ping?":"क्या DNS बदलने से पिंग कम होगा?","Should I upgrade my internet plan to fix high ping?":"क्या उच्च पिंग ठीक करने के लिए इंटरनेट प्लान अपग्रेड करना चाहिए?","Find the next step when your internet acts up.":"इंटरनेट में समस्या आने पर अगला सही कदम जानें।","What is going wrong?":"क्या समस्या हो रही है?","Three useful rules before you troubleshoot":"समस्या जाँचने से पहले तीन उपयोगी नियम","1. Compare more than one device":"1. एक से अधिक डिवाइस की तुलना करें","2. Separate Wi-Fi from the internet connection":"2. वाई-फ़ाई की समस्या और इंटरनेट कनेक्शन की समस्या अलग-अलग पहचानें","3. Change one variable at a time":"3. एक बार में केवल एक बदलाव करें","Measure before and after":"बदलाव से पहले और बाद में मापें","How to read what your checks show":"जाँच के परिणामों को कैसे समझें","Wired works well, Wi-Fi struggles":"केबल से कनेक्शन अच्छा है, वाई-फ़ाई में समस्या है","Several devices struggle, including over Ethernet":"ईथरनेट से जुड़े डिवाइस सहित कई डिवाइस में समस्या है","Only one device or one app has trouble":"केवल एक डिवाइस या ऐप में समस्या है","Download looks fine, but calls or games still lag":"डाउनलोड ठीक है, लेकिन कॉल या गेम में फिर भी लैग है","When should you contact your internet provider?":"इंटरनेट सेवा प्रदाता से कब संपर्क करना चाहिए?","Common troubleshooting questions":"समस्या समाधान से जुड़े आम सवाल","Should I restart my router every time the internet slows down?":"क्या इंटरनेट धीमा होने पर हर बार राउटर रीस्टार्ट करना चाहिए?","Does a fast speed test mean my connection is healthy?":"क्या तेज़ स्पीड टेस्ट का मतलब है कि मेरा कनेक्शन सही है?","Should I change DNS to fix weak Wi-Fi?":"क्या कमज़ोर वाई-फ़ाई ठीक करने के लिए DNS बदलना चाहिए?","Is it safe to factory-reset my router?":"क्या राउटर को फ़ैक्टरी रीसेट करना सुरक्षित है?","Related Internet Knowledge Hub guides":"इंटरनेट ज्ञान केंद्र की संबंधित गाइड"});
  Object.assign(copy.mr, {"In this guide":"या मार्गदर्शिकेत","Keep learning":"पुढे शिका","Try it yourself":"स्वतः करून पाहा","What does internet speed actually mean?":"इंटरनेटचा वेग म्हणजे नेमके काय?","Download speed and upload speed: what's the difference?":"डाउनलोड आणि अपलोड वेगात काय फरक आहे?","How much speed do you need?":"तुम्हाला किती इंटरनेट वेगाची गरज आहे?","How much internet speed might your home need?":"तुमच्या घराला किती इंटरनेट वेगाची गरज असू शकते?","How long will a download or upload take?":"डाउनलोड किंवा अपलोड होण्यासाठी किती वेळ लागेल?","How to get a useful speed-test result":"उपयुक्त स्पीड टेस्ट निकाल कसा मिळवावा","How to read your internet speed test results":"इंटरनेट स्पीड टेस्टचे निकाल कसे समजून घ्यावेत","Download and upload: look at both directions":"डाउनलोड आणि अपलोड—दोन्ही बाजू तपासा","Latency: how quickly does a response come back?":"लेटन्सी: प्रतिसाद किती लवकर परत येतो?","Jitter and packet loss: is the connection consistent?":"जिटर आणि पॅकेट लॉस: कनेक्शन स्थिर आहे का?","Why one test may show a different result from another":"वेगवेगळ्या चाचण्यांचे निकाल वेगळे का असू शकतात?","Does a faster internet plan always make everything faster?":"वेगवान इंटरनेट प्लॅनमुळे प्रत्येक गोष्ट वेगवान होते का?","Bandwidth, speed and performance are related—but not identical":"बँडविड्थ, वेग आणि कार्यक्षमता संबंधित आहेत—पण एकसारखे नाहीत","Frequently asked questions about internet speed":"इंटरनेट वेगाबद्दल वारंवार विचारले जाणारे प्रश्न","What TEZZ CONNECT measures":"TEZZ CONNECT काय मोजते","Check your connection":"तुमचे कनेक्शन तपासा","Common questions about internet speed":"इंटरनेट वेगाबद्दल सामान्य प्रश्न","Is 100 Mbps the same as 100 MB per second?":"100 Mbps म्हणजे 100 MB प्रति सेकंद का?","Why does my download speed change during the day?":"दिवसभरात माझा डाउनलोड वेग का बदलतो?","Will a faster plan fix buffering?":"वेगवान प्लॅनमुळे बफरिंगची समस्या सुटेल का?","Why is my speed test good but one website slow?":"स्पीड टेस्ट चांगली असूनही एखादी वेबसाइट संथ का आहे?","How many speed tests should I run?":"मी किती स्पीड टेस्ट कराव्यात?","Should I choose my internet plan based only on download speed?":"फक्त डाउनलोड वेगावरून इंटरनेट प्लॅन निवडावा का?","What is latency?":"लेटन्सी म्हणजे काय?","What does ping mean?":"पिंग म्हणजे काय?","What is jitter?":"जिटर म्हणजे काय?","Why do these numbers matter?":"हे आकडे महत्त्वाचे का आहेत?","See how delay, jitter and packet loss change a connection":"विलंब, जिटर आणि पॅकेट लॉसमुळे कनेक्शन कसे बदलते ते पाहा","What can you do if response times are high?":"प्रतिसाद वेळ जास्त असल्यास तुम्ही काय करू शकता?","Why a fast internet plan can still feel slow":"वेगवान इंटरनेट प्लॅन असूनही कनेक्शन संथ का वाटते","Four common reasons for high ping or unstable jitter":"जास्त पिंग किंवा अस्थिर जिटरची चार सामान्य कारणे","1. Wi-Fi interference or a weak signal":"1. वाय-फायमध्ये व्यत्यय किंवा कमकुवत सिग्नल","2. A busy connection (sometimes called bufferbloat)":"2. व्यस्त कनेक्शन (कधीकधी बफरब्लोट म्हणतात)","3. Distance and the route to the service":"3. अंतर आणि सेवेकडे जाणारा नेटवर्क मार्ग","4. Congestion beyond your home":"4. घराबाहेरील नेटवर्कमधील गर्दी","A simple way to isolate the source of the delay":"विलंबाचे मूळ कारण शोधण्याची सोपी पद्धत","What counts as good latency or jitter?":"चांगली लेटन्सी किंवा जिटर किती असावी?","Frequently asked questions about ping and jitter":"पिंग आणि जिटरबद्दल वारंवार विचारले जाणारे प्रश्न","Is ping the same as latency?":"पिंग आणि लेटन्सी एकच आहेत का?","Can I have high download speed but high ping?":"डाउनलोड वेग जास्त असूनही पिंग जास्त असू शकतो का?","Does jitter matter more than ping?":"पिंगपेक्षा जिटर अधिक महत्त्वाचा आहे का?","Will changing DNS reduce ping?":"DNS बदलल्याने पिंग कमी होईल का?","Should I upgrade my internet plan to fix high ping?":"जास्त पिंग कमी करण्यासाठी इंटरनेट प्लॅन अपग्रेड करावा का?","Find the next step when your internet acts up.":"इंटरनेटमध्ये अडचण आल्यास पुढचे योग्य पाऊल शोधा.","What is going wrong?":"नेमकी अडचण काय आहे?","Three useful rules before you troubleshoot":"समस्या तपासण्यापूर्वी तीन उपयुक्त नियम","1. Compare more than one device":"1. एकापेक्षा जास्त उपकरणांची तुलना करा","2. Separate Wi-Fi from the internet connection":"2. वाय-फायची समस्या आणि इंटरनेट कनेक्शनची समस्या वेगळी ओळखा","3. Change one variable at a time":"3. एका वेळी एकच गोष्ट बदला","Measure before and after":"बदलापूर्वी आणि नंतर मोजमाप करा","How to read what your checks show":"तपासणीचे निष्कर्ष कसे समजून घ्यावेत","Wired works well, Wi-Fi struggles":"केबलने कनेक्शन चांगले आहे, वाय-फायमध्ये अडचण आहे","Several devices struggle, including over Ethernet":"इथरनेटने जोडलेल्या उपकरणांसह अनेक उपकरणांमध्ये अडचण आहे","Only one device or one app has trouble":"फक्त एका उपकरणात किंवा ॲपमध्ये अडचण आहे","Download looks fine, but calls or games still lag":"डाउनलोड ठीक आहे, पण कॉल किंवा गेममध्ये अजूनही लॅग आहे","When should you contact your internet provider?":"इंटरनेट सेवा प्रदात्याशी कधी संपर्क साधावा?","Common troubleshooting questions":"समस्या निवारणाबद्दल सामान्य प्रश्न","Should I restart my router every time the internet slows down?":"इंटरनेट संथ झाल्यावर प्रत्येक वेळी राउटर रीस्टार्ट करावा का?","Does a fast speed test mean my connection is healthy?":"स्पीड टेस्ट चांगली म्हणजे माझे कनेक्शन व्यवस्थित आहे का?","Should I change DNS to fix weak Wi-Fi?":"कमकुवत वाय-फाय सुधारण्यासाठी DNS बदलावा का?","Is it safe to factory-reset my router?":"राउटर फॅक्टरी रीसेट करणे सुरक्षित आहे का?","Related Internet Knowledge Hub guides":"इंटरनेट ज्ञान केंद्रातील संबंधित मार्गदर्शिका"});
  Object.assign(copy.bn, {"In this guide":"এই গাইডে","Keep learning":"শিখতে থাকুন","Try it yourself":"নিজে চেষ্টা করুন","What does internet speed actually mean?":"ইন্টারনেটের গতি বলতে আসলে কী বোঝায়?","Download speed and upload speed: what's the difference?":"ডাউনলোড ও আপলোড গতির মধ্যে পার্থক্য কী?","How much speed do you need?":"আপনার কতটা ইন্টারনেট গতি দরকার?","How much internet speed might your home need?":"আপনার বাড়ির কতটা ইন্টারনেট গতি প্রয়োজন হতে পারে?","How long will a download or upload take?":"ডাউনলোড বা আপলোড করতে কত সময় লাগবে?","How to get a useful speed-test result":"কীভাবে কার্যকর স্পিড টেস্টের ফল পাবেন","How to read your internet speed test results":"ইন্টারনেট স্পিড টেস্টের ফল কীভাবে বুঝবেন","Download and upload: look at both directions":"ডাউনলোড ও আপলোড—দুই দিকই দেখুন","Latency: how quickly does a response come back?":"লেটেন্সি: উত্তর কত দ্রুত ফিরে আসে?","Jitter and packet loss: is the connection consistent?":"জিটার ও প্যাকেট লস: সংযোগ কি স্থিতিশীল?","Why one test may show a different result from another":"একেকটি পরীক্ষায় ফল আলাদা হতে পারে কেন?","Does a faster internet plan always make everything faster?":"দ্রুত ইন্টারনেট প্ল্যান কি সবকিছু দ্রুত করে?","Bandwidth, speed and performance are related—but not identical":"ব্যান্ডউইথ, গতি ও কর্মক্ষমতা সম্পর্কিত—তবে এক নয়","Frequently asked questions about internet speed":"ইন্টারনেটের গতি নিয়ে সাধারণ প্রশ্ন","What TEZZ CONNECT measures":"TEZZ CONNECT কী পরিমাপ করে","Check your connection":"আপনার সংযোগ পরীক্ষা করুন","Common questions about internet speed":"ইন্টারনেটের গতি নিয়ে সাধারণ প্রশ্ন","Is 100 Mbps the same as 100 MB per second?":"100 Mbps কি প্রতি সেকেন্ডে 100 MB-এর সমান?","Why does my download speed change during the day?":"দিনের বিভিন্ন সময়ে ডাউনলোডের গতি বদলায় কেন?","Will a faster plan fix buffering?":"দ্রুত প্ল্যান কি বাফারিং সমস্যার সমাধান করবে?","Why is my speed test good but one website slow?":"স্পিড টেস্ট ভালো হলেও একটি ওয়েবসাইট ধীর কেন?","How many speed tests should I run?":"কতবার স্পিড টেস্ট করা উচিত?","Should I choose my internet plan based only on download speed?":"শুধু ডাউনলোডের গতি দেখে কি ইন্টারনেট প্ল্যান বেছে নেওয়া উচিত?","What is latency?":"লেটেন্সি কী?","What does ping mean?":"পিং বলতে কী বোঝায়?","What is jitter?":"জিটার কী?","Why do these numbers matter?":"এই সংখ্যাগুলি গুরুত্বপূর্ণ কেন?","See how delay, jitter and packet loss change a connection":"বিলম্ব, জিটার ও প্যাকেট লস কীভাবে সংযোগ বদলে দেয় দেখুন","What can you do if response times are high?":"প্রতিক্রিয়ার সময় বেশি হলে আপনি কী করতে পারেন?","Why a fast internet plan can still feel slow":"দ্রুত ইন্টারনেট প্ল্যানও ধীর মনে হতে পারে কেন","Four common reasons for high ping or unstable jitter":"বেশি পিং বা অস্থির জিটারের চারটি সাধারণ কারণ","1. Wi-Fi interference or a weak signal":"1. ওয়াই-ফাইতে বাধা বা দুর্বল সিগন্যাল","2. A busy connection (sometimes called bufferbloat)":"2. ব্যস্ত সংযোগ (কখনও বাফারব্লোট বলা হয়)","3. Distance and the route to the service":"3. দূরত্ব ও পরিষেবায় পৌঁছানোর নেটওয়ার্ক পথ","4. Congestion beyond your home":"4. বাড়ির বাইরের নেটওয়ার্কে ভিড়","A simple way to isolate the source of the delay":"বিলম্বের উৎস খুঁজে বের করার সহজ উপায়","What counts as good latency or jitter?":"কতটা লেটেন্সি বা জিটার ভালো বলে ধরা হয়?","Frequently asked questions about ping and jitter":"পিং ও জিটার নিয়ে সাধারণ প্রশ্ন","Is ping the same as latency?":"পিং ও লেটেন্সি কি একই?","Can I have high download speed but high ping?":"ডাউনলোডের গতি বেশি হলেও কি পিং বেশি হতে পারে?","Does jitter matter more than ping?":"পিংয়ের চেয়ে জিটার কি বেশি গুরুত্বপূর্ণ?","Will changing DNS reduce ping?":"DNS বদলালে কি পিং কমবে?","Should I upgrade my internet plan to fix high ping?":"বেশি পিং কমাতে কি ইন্টারনেট প্ল্যান আপগ্রেড করা উচিত?","Find the next step when your internet acts up.":"ইন্টারনেটে সমস্যা হলে পরবর্তী করণীয় খুঁজে নিন।","What is going wrong?":"কী সমস্যা হচ্ছে?","Three useful rules before you troubleshoot":"সমস্যা সমাধানের আগে তিনটি কার্যকর নিয়ম","1. Compare more than one device":"1. একাধিক ডিভাইসের তুলনা করুন","2. Separate Wi-Fi from the internet connection":"2. ওয়াই-ফাই সমস্যা ও ইন্টারনেট সংযোগের সমস্যা আলাদা করুন","3. Change one variable at a time":"3. একবারে একটি বিষয় পরিবর্তন করুন","Measure before and after":"পরিবর্তনের আগে ও পরে মাপুন","How to read what your checks show":"পরীক্ষার ফল কীভাবে বুঝবেন","Wired works well, Wi-Fi struggles":"তারযুক্ত সংযোগ ভালো, ওয়াই-ফাইতে সমস্যা","Several devices struggle, including over Ethernet":"ইথারনেট-সহ একাধিক ডিভাইসে সমস্যা হচ্ছে","Only one device or one app has trouble":"শুধু একটি ডিভাইস বা অ্যাপে সমস্যা","Download looks fine, but calls or games still lag":"ডাউনলোড ঠিক আছে, কিন্তু কল বা গেমে এখনও ল্যাগ হচ্ছে","When should you contact your internet provider?":"কখন ইন্টারনেট পরিষেবা প্রদানকারীর সঙ্গে যোগাযোগ করবেন?","Common troubleshooting questions":"সমস্যা সমাধান নিয়ে সাধারণ প্রশ্ন","Should I restart my router every time the internet slows down?":"ইন্টারনেট ধীর হলেই কি রাউটার রিস্টার্ট করা উচিত?","Does a fast speed test mean my connection is healthy?":"স্পিড টেস্ট দ্রুত হলেই কি সংযোগ ভালো বোঝায়?","Should I change DNS to fix weak Wi-Fi?":"দুর্বল ওয়াই-ফাই ঠিক করতে কি DNS বদলানো উচিত?","Is it safe to factory-reset my router?":"রাউটার ফ্যাক্টরি রিসেট করা কি নিরাপদ?","Related Internet Knowledge Hub guides":"ইন্টারনেট জ্ঞানকেন্দ্রের সম্পর্কিত গাইড"});
  const readLanguage = () => {
    try {
      const value = localStorage.getItem(KEY) || 'en';
      return supported.has(value) ? value : 'en';
    } catch { return 'en'; }
  };
  let language = 'en';
  const originals = new WeakMap();
  const localeBundles = Object.create(null);
  const sourceStrings = {
    'common.next': 'Next step →',
    'common.choose_language': 'Choose website language',
    'common.language': 'Website language',
    'common.step_count': 'STEP',
    'common.of': 'OF',
    'common.journey_complete': 'Journey complete',
    'common.choose_answer': 'Choose an answer first.',
    'common.dns_feedback': 'DNS helps find the network address associated with a domain name. It does not boost Wi-Fi signal or increase your plan speed.',
    'common.correct_prefix': 'Correct! ',
    'common.incorrect_prefix': 'Not quite. ',
    'common.less_second': 'Less than 1 second',
    'common.about': 'About',
    'common.second': 'seconds',
    'common.minute': 'minutes',
    'common.hour': 'hours',
    'common.enter_valid_transfer': 'Enter a file size above 0 (up to 100,000) and a speed above 0 Mbps (up to 100,000).',
    'common.estimate_at': 'At ',
    'common.file_may_take': ' file may take ',
    'common.to_transfer': ' to transfer ',
    'common.download_word': 'download',
    'common.upload_word': 'upload',
    'common.transfer_end': ' in this estimate.',
    'guide.internet.quiz_explanation': "That's right. Wi-Fi is the wireless link between your devices and router. Your internet service is the connection from your home network to other networks.",
    'guide.internet.part.device.kicker': "START HERE",
    'guide.internet.part.device.title': "Your device starts the request",
    'guide.internet.part.device.description': "Your phone or computer asks for a website when you type an address, tap a link or open an app.",
    'guide.internet.part.device.impact': "An older device, busy background apps or an outdated browser can make pages feel slow even when the connection is fine.",
    'guide.internet.part.wifi.kicker': "LOCAL CONNECTION",
    'guide.internet.part.wifi.title': "Wi-Fi or Ethernet carries data to your router",
    'guide.internet.part.wifi.description': "Wi-Fi sends data wirelessly through radio signals. Ethernet uses a cable. Both connect your device to your home network.",
    'guide.internet.part.wifi.impact': "Distance, thick walls and radio interference can weaken Wi-Fi. A damaged cable or adapter can affect a wired connection.",
    'guide.internet.part.router.kicker': "HOME NETWORK",
    'guide.internet.part.router.title': "The router directs traffic",
    'guide.internet.part.router.description': "Your router connects devices in your home and forwards their data towards the internet. It also helps returning data reach the right device.",
    'guide.internet.part.router.impact': "Poor router placement, old equipment, overloaded hardware or incorrect settings can affect the whole home network.",
    'guide.internet.part.provider.kicker': "NETWORK TO NETWORK",
    'guide.internet.part.provider.title': "Your provider links your home to other networks",
    'guide.internet.part.provider.description': "Your internet service provider carries traffic from your home connection into its network and towards the destination. The route can cross several operators.",
    'guide.internet.part.provider.impact': "Network congestion, line faults or an issue in the provider network can slow many websites and apps at once.",
    'guide.internet.part.dns.kicker': "NAME LOOKUP",
    'guide.internet.part.dns.title': "DNS helps find the website address",
    'guide.internet.part.dns.description': "The Domain Name System helps match a name such as example.com with the IP address used to reach the service. A saved answer may be reused, so a new lookup is not always needed.",
    'guide.internet.part.dns.impact': "A DNS problem can stop a name from resolving even when your internet connection itself is working.",
    'guide.internet.part.server.kicker': "DESTINATION",
    'guide.internet.part.server.title': "The website service sends the page data",
    'guide.internet.part.server.description': "The request reaches the website service. It returns the files and information your browser needs. A nearby cache or content delivery network may serve some files.",
    'guide.internet.part.server.impact': "A busy or distant server, large page files or a slow service can make one website slow while other sites work normally.",
    'guide.journey.lede': "You tap a link. A moment later, a website appears. Let's follow that request through the network, one step at a time—without the technical fog.",
    'guide.journey.intro': "Imagine opening a website on your phone at home. Select Next step to follow the request from your device to the website, then watch the response travel back.",
    'guide.journey.node.device': "Your device",
    'guide.journey.node.device.help': "Asks for a page",
    'guide.journey.node.wifi': "Wi-Fi or cable",
    'guide.journey.node.wifi.help': "Local connection",
    'guide.journey.node.router': "Home router",
    'guide.journey.node.router.help': "Forwards traffic",
    'guide.journey.node.provider': "Internet provider",
    'guide.journey.node.provider.help': "Connects networks",
    'guide.journey.node.dns': "DNS lookup",
    'guide.journey.node.dns.help': "Finds the address",
    'guide.journey.node.server': "Website server",
    'guide.journey.node.server.help': "Sends page data",
    'guide.journey.flow.request': "REQUEST travels towards the website →",
    'guide.journey.flow.response': "← RESPONSE returns to your device",
    'guide.journey.progress': "Journey progress",
    'guide.journey.packet.label': "A page is exchanged as many small pieces of data.",
    'guide.journey.dns_text': "People remember names such as tezzconnect.online. Computers use IP addresses to identify destinations on a network. The Domain Name System (DNS) helps translate a domain name into the address needed to find the service. Your device or network may already have a saved answer, so a fresh lookup is not always needed for every visit.",
    'guide.journey.related.basics.title': "Internet basics",
    'guide.journey.related.basics.description': "Understand the main parts of the internet.",
    'guide.journey.related.speed.title': "Internet speed explained",
    'guide.journey.related.speed.description': "Learn what Mbps and bandwidth mean.",
    'guide.journey.related.latency.title': "Latency and jitter",
    'guide.journey.related.latency.description': "See why response time and consistency matter.",
    'guide.journey.related.glossary.title': "Networking glossary",
    'guide.journey.related.glossary.description': "Look up terms such as DNS, router, IP address and packet.",
    'guide.journey.related.glossary.read': "Explore the glossary →",
    'guide.journey.roadmap': "Continue with the full Internet Learning Roadmap →",
    'guide.journey.meta': "TEZZ CONNECT · Interactive visual guide",
    'guide.journey.eyebrow': "VISUAL LEARNING · BEGINNER",
    'guide.journey.interactive': "INTERACTIVE NETWORK JOURNEY",
    'guide.journey.quiz.eyebrow': "QUICK KNOWLEDGE CHECK",
    'guide.journey.related.eyebrow': "KEEP LEARNING",
    'guide.journey.breadcrumb.roadmap': "Learning roadmap",
    'guide.journey.breadcrumb.hub': "Internet Knowledge Hub",
    'guide.journey.roadmap': "Continue with the full Internet Learning Roadmap →",
    'guide.journey.network_text': "The internet is a network of networks. Your home network connects to your provider, and your provider connects with other networks. Information can cross many different networks before reaching its destination.",
    'guide.journey.step.0.title': "Your device makes a request",
    'guide.journey.step.0.description': "You type a website name or tap a link. Your browser needs to find the computer or service that can provide that page.",
    'guide.journey.step.0.analogy': "Think of writing the name of a place on a parcel before sending it.",
    'guide.journey.step.0.status': "Your browser has a destination in mind.",
    'guide.journey.step.1.title': "Your device joins the local network",
    'guide.journey.step.1.description': "Your phone sends data over Wi-Fi, or your laptop sends it through an Ethernet cable. This gets the request from your device to your home network.",
    'guide.journey.step.1.analogy': "Wi-Fi is the local road from your device to the router. It is not the whole internet.",
    'guide.journey.step.1.status': "The request is moving across your home connection.",
    'guide.journey.step.2.title': "Your router forwards the traffic",
    'guide.journey.step.2.description': "The router connects your home devices and forwards traffic towards your internet connection. It also helps send returning information to the correct device.",
    'guide.journey.step.2.analogy': "A router is like a building's mailroom: it helps direct incoming and outgoing items to the right place.",
    'guide.journey.step.2.status': "Your router is passing the request onwards.",
    'guide.journey.step.3.title': "Your internet provider connects networks",
    'guide.journey.step.3.description': "Your internet service provider carries traffic from your connection into its network and towards other networks. The route may pass through several network operators.",
    'guide.journey.step.3.analogy': "Think of changing from a local street to a larger road network. There can be several routes to the destination.",
    'guide.journey.step.3.status': "The request is travelling across connected networks.",
    'guide.journey.step.4.title': "DNS helps find the website address",
    'guide.journey.step.4.description': "The Domain Name System helps look up the IP address associated with the website name. Your device or network may already have a cached answer, so a new lookup is not always necessary.",
    'guide.journey.step.4.analogy': "DNS works a little like looking up a person's name in a contacts list to find the number to call.",
    'guide.journey.step.4.status': "The destination name can now be matched to a network address.",
    'guide.journey.step.5.title': "The website server receives the request",
    'guide.journey.step.5.description': "The request reaches the service hosting the website. The server prepares the information your browser needs. A nearby cache or content delivery network may handle some files instead.",
    'guide.journey.step.5.analogy': "The destination has received your request and is preparing the reply.",
    'guide.journey.step.5.status': "The website is preparing the response.",
    'guide.journey.step.6.title': "The page data travels back",
    'guide.journey.step.6.description': "The server sends the required data back through networks towards your device. Data is commonly split into packets, and the receiving systems process the pieces.",
    'guide.journey.step.6.analogy': "Instead of one enormous parcel, imagine the page arriving as several labelled packages.",
    'guide.journey.step.6.status': "The response is travelling back towards your home.",
    'guide.journey.step.7.title': "Your browser builds the page",
    'guide.journey.step.7.description': "Your device receives the resources and your browser puts the text, images, styles and other page parts together. The website appears on your screen.",
    'guide.journey.step.7.analogy': "Your browser is like the person unpacking the delivered pieces and assembling the finished item.",
    'guide.journey.step.7.status': "Journey complete. You can restart or revisit any step.",
    'guide.speed.body.mbps_intro': "Internet speed tells you how quickly data can move between your device and another point on the internet. You will usually see it written as Mbps, which means megabits per second.",
    'guide.speed.body.units': "Here is an easy way to understand the units: internet plans use megabits (Mb), while file sizes are often shown in megabytes (MB). Eight bits make one byte. So, 100 Mbps works out to a theoretical maximum of about 12.5 MB per second, before normal network overhead and other limits.",
    'guide.speed.body.snapshot': "A speed test is a snapshot. It measures your connection to a particular test server at that moment. It does not mean every app, game or website will run at that exact rate.",
    'guide.speed.body.download': "Download speed is how quickly information comes to your device. You use it when you watch a video, open a website, download an app or receive a file.",
    'guide.speed.body.upload': "Upload speed is how quickly information goes from your device to the internet. You use it when you send photos, back up files, share your screen or speak on a video call.",
    'guide.speed.body.example': "For example, watching a movie mostly uses download speed. Sending a large video to a friend mostly uses upload speed. A video call uses both because you receive the other person's video and send your own.",
    'guide.speed.body.needs_intro': "There is no magic number that suits every home. It depends on how many people are online, what they are doing and whether several activities happen at the same time. Use this as a simple starting point, not as a guaranteed minimum:",
    'guide.speed.body.planner_intro': "Choose the activities happening at the same time. The planner estimates a useful starting point for download and upload capacity, with extra room for normal variation.",
    'guide.speed.body.test_intro': "If you want to know whether your connection is performing well, try to make the test fair:",
    'guide.speed.body.test_variation': "If the result changes a lot, look for a pattern. A single low result does not automatically mean your provider is at fault. The device, Wi-Fi signal, busy home network, test server and route can all make a difference.",
    'guide.speed.body.read_intro': "A speed test is useful when you treat it as a measurement under specific conditions, rather than a permanent rating for your broadband. The result reflects the device, connection type, test server, route and network activity at the time you ran it. Two tests can disagree without either one being broken.",
    'guide.speed.body.measure': "TEZZ CONNECT measures download and upload throughput using its own test endpoints. Its latency and jitter figures are based on HTTP request-and-response timing to the TEZZ network edge; they are not ICMP ping measurements. Results can change with your device, network and route.",
    'guide.speed.planner.explanation': "Suggested starting point includes about 30% planning headroom. It is not a guaranteed minimum.",
    'guide.speed.planner.breakdown': "Estimated active demand: ",
    'guide.speed.quiz.choose_first': "Choose an answer first, then check it.",
    'guide.speed.quiz.correct': "Correct! ",
    'guide.speed.quiz.not_quite': "Not quite. ",
    'guide.speed.faq.q1': "Is 100 Mbps the same as 100 MB per second?",
    'guide.speed.faq.a1': "No. Mbps means megabits per second; MB/s means megabytes per second. Since one byte contains eight bits, 100 Mbps is a theoretical maximum of 12.5 MB/s before protocol overhead and other limits. A real download may be lower.",
    'guide.speed.faq.q2': "Why does my download speed change during the day?",
    'guide.speed.faq.a2': "Wi-Fi conditions, household activity, provider network demand, the test server and the route can all change. Repeat the test at different times with the same device and method. A consistent pattern is more useful than one isolated result.",
    'guide.speed.faq.q3': "Will a faster plan fix buffering?",
    'guide.speed.faq.a3': "It may help if your current connection does not have enough throughput for the video quality and other simultaneous activities. But buffering can also come from Wi-Fi problems, device performance, a busy streaming service or a network route. Check the cause before upgrading.",
    'guide.speed.faq.q4': "Why is my speed test good but one website slow?",
    'guide.speed.faq.a4': "A speed test measures a connection to its own server. A particular website may be farther away, busy, or affected by its own hosting, routing or browser issues. Try another website and device, and check whether the problem is limited to one service.",
    'guide.speed.faq.q5': "How many speed tests should I run?",
    'guide.speed.faq.a5': "For a quick check, run two or three tests under similar conditions. If you are troubleshooting, repeat at different times and compare Wi-Fi with Ethernet where possible. Avoid running many tests back-to-back while other devices are using the connection, because the tests themselves consume bandwidth.",
    'guide.speed.faq.q6': "Should I choose my internet plan based only on download speed?",
    'guide.speed.faq.a6': "No. Consider upload speed, the number of people and devices in your home, the activities you do at the same time, data limits, reliability and the technology available at your address. For gaming and calls, latency and stability also matter.",
    'guide.speed.faq.q7': "Is 100 Mbps fast enough for a family?",
    'guide.speed.faq.a7': "It can be enough for many homes, but it depends on how many people stream, join video calls, download files and use the internet at the same time. Use the household planner above as a starting point, then compare it with your real usage.",
    'guide.speed.faq.q8': "Why is my download speed lower than my internet plan?",
    'guide.speed.faq.a8': "Wi-Fi signal, distance from the router, device limits, network congestion, background downloads and the test server can all affect a result. Test more than once and compare Wi-Fi with Ethernet if possible.",
    'guide.speed.faq.q9': "Does upload speed matter?",
    'guide.speed.faq.a9': "Yes. Upload speed affects sending files, cloud backups, live streaming and the video or audio you send during online meetings.",
    'guide.speed.faq.q10': "Are Mbps and MB/s the same?",
    'guide.speed.faq.a10': "No. Mbps means megabits per second, while MB/s means megabytes per second. One byte contains eight bits, so divide Mbps by eight for a theoretical MB/s figure before allowing for network overhead.",
    'guide.speed.body.transfer_intro': "Enter the file size and your internet speed to get a rough time estimate. This is useful when downloading a game, saving a large video, backing up photos or sending work files.",
    'guide.speed.body.read_directions': "Compare each result with the corresponding rate in your broadband plan. Some plans are asymmetric, so the upload rate may be lower by design. If downloads are close to the plan's expected performance but uploads are consistently poor, investigate the upstream side rather than assuming the whole connection is slow.",
    'guide.speed.body.read_latency': "Latency is about waiting time, not how much data can move each second. It can affect how responsive a website, game or video call feels. A connection can deliver a large file quickly but still feel sluggish when small requests take a long time to get a response. Read more in our guide to latency, ping and jitter.",
    'guide.speed.body.read_jitter': "Jitter describes variation in packet or response timing, depending on the measurement method. Packet loss means some data does not arrive at its destination. These issues can disrupt real-time activities even when average download speed looks healthy. Not every browser speed test measures packet loss or network jitter directly, so check what the tool actually reports.",
    'guide.speed.body.read_consistency': "For a meaningful comparison, keep the device, test service, server and connection type as consistent as possible. If you are investigating a problem, change one condition at a time and write down what changed.",
    'guide.speed.body.upgrade_explain': "No. A higher plan can increase the amount of data your connection can transfer at once, which helps when several people are streaming, downloading or uploading. But it does not automatically shorten the physical route to a server, improve a weak Wi-Fi signal, remove packet loss or fix a busy remote service.",
    'guide.speed.body.upgrade_bottleneck': "Think about the bottleneck. If your household regularly uses all the available bandwidth, a faster plan may help. If the problem happens only in one room, on one device or with one online service, upgrading the plan may not solve it. First compare wired and wireless results, try more than one destination and check whether the issue appears at busy times.",
    'guide.speed.body.bandwidth_explain': "People often use “internet speed” to describe several different measurements. In technical terms, bandwidth is the capacity of a connection, throughput is the data rate actually achieved, and latency is the time taken for a response. They work together, but they answer different questions.",
    'guide.speed.body.bandwidth_context': "This distinction helps explain why a speed-test number alone cannot describe the entire quality of an internet connection. For example, a video call needs enough throughput in both directions, but it also benefits from low delay, low variation and minimal packet loss.",
    'guide.speed.body.tool_intro': "Run the free TEZZ CONNECT test and compare your download and upload results.",
    'guide.speed.body.related_intro': "Build on this topic with these practical TEZZ CONNECT guides.",
    'guide.speed.body.quiz_feedback': "Correct. Eight bits make one byte, so 100 Mbps is theoretically about 12.5 MB/s before overhead and other limits.",
    'guide.speed.table.activity': "What you're doing",
    'guide.speed.table.note': "What to keep in mind",
    'guide.speed.table.browse': "Browsing and email",
    'guide.speed.table.browse_note': "These usually need less bandwidth. A stable connection often matters more than a very high plan.",
    'guide.speed.table.hd': "HD video",
    'guide.speed.table.hd_note': "Allow enough download capacity for each stream, plus room for other people using the connection.",
    'guide.speed.table.4k': "4K video",
    'guide.speed.table.4k_note': "Needs more steady download capacity than HD. Check the streaming service's current recommendation.",
    'guide.speed.table.meet': "Video meetings",
    'guide.speed.table.meet_note': "Both download and upload matter. A steady connection helps avoid frozen video and broken audio.",
    'guide.speed.table.cloud': "Cloud backup and file sharing",
    'guide.speed.table.cloud_note': "Upload speed matters, especially when sending large files.",
    'guide.speed.table.game': "Online gaming",
    'guide.speed.table.game_note': "Fast downloads help with updates, but response time and connection stability can matter more during a match.",
    'guide.speed.planner.eyebrow': "INTERACTIVE HOUSEHOLD PLANNER",
    'guide.speed.planner.hd': "HD video streams",
    'guide.speed.planner.hd_help': "Illustrative allowance: 5 Mbps download each",
    'guide.speed.planner.4k': "4K video streams",
    'guide.speed.planner.4k_help': "Illustrative allowance: 25 Mbps download each",
    'guide.speed.planner.calls': "Video calls",
    'guide.speed.planner.calls_help': "Planning allowance: 4 Mbps down and 3 Mbps up each",
    'guide.speed.planner.uploads': "Large file uploads in progress",
    'guide.speed.planner.uploads_help': "Illustrative allowance: 8 Mbps upload each",
    'guide.speed.planner.start': "ESTIMATED STARTING POINT",
    'guide.speed.planner.down': "Mbps download",
    'guide.speed.planner.up': "Mbps upload",
    'guide.speed.planner.disclaimer': "These are simple planning assumptions, not official minimums or a guarantee. Actual requirements vary by app, video quality, device, Wi-Fi conditions and simultaneous activity. Check the service provider's recommendations for your apps. Gaming is often more sensitive to latency and stability than raw bandwidth.",
    'guide.speed.planner.important': "Important",
    'guide.speed.transfer.eyebrow': "FREE INTERACTIVE SPEED CALCULATOR",
    'guide.speed.transfer.speed_label': "Your ",
    'guide.speed.transfer.speed_suffix': " speed (Mbps)",
    'guide.speed.transfer.result_label': "ESTIMATED TIME",
    'guide.speed.transfer.explanation': "At 100 Mbps, a 2 GB download is estimated at about 3 minutes 20 seconds using the stated 80% planning allowance.",
    'guide.speed.transfer.note': "The estimate allows for about 80% of the entered speed being available for file data. Real transfers can take longer.",
    'guide.speed.transfer.tip_title': "Quick tip:",
    'guide.speed.transfer.tip': "A 100 Mbps plan does not mean 100 MB downloads every second. Mbps is megabits; MB is megabytes. There are 8 bits in 1 byte.",
    'guide.speed.transfer.speed_download': "download",
    'guide.speed.transfer.speed_upload': "upload",
    'guide.speed.test.step1': "Pause large downloads, backups and video streams if you can.",
    'guide.speed.test.step2': "Use one device for the test. If possible, connect it to the router with an Ethernet cable.",
    'guide.speed.test.step3': "If you're testing Wi-Fi, stand reasonably close to the router.",
    'guide.speed.test.step4': "Run the test a few times, including at a different time of day.",
    'guide.speed.test.step5': "Write down whether you used Wi-Fi or Ethernet and which device you tested.",
    'guide.speed.quiz.question': "Your plan shows 100 Mbps. A file download does not show 100 MB every second. Is that automatically a problem?",
    'guide.speed.quiz.option0': "Yes. Mbps and MB/s are identical.",
    'guide.speed.quiz.option1': "No. Mbps measures megabits; MB/s measures megabytes. Eight bits make one byte.",
    'guide.speed.quiz.option2': "Yes. Your router must be replaced.",
    'guide.speed.quiz.button': "Check my answer",
    'guide.speed.related.card1.title': "Upload speed explained",
    'guide.speed.related.card1.desc': "Understand the data your devices send upstream.",
    'guide.speed.related.card2.title': "Internet speed for gaming",
    'guide.speed.related.card2.desc': "See why stable response time matters in games.",
    'guide.speed.related.card3.title': "What is the internet?",
    'guide.speed.related.card3.desc': "Start with the networks behind your connection.",
    'guide.speed.related.read': "Read guide →",
    'guide.internet.title': "What is the internet and how does it work?",
    'guide.internet.lede': "The internet can feel invisible: you tap a link and a page appears. Behind that simple action is a worldwide system of connected networks, routers, cables, wireless links and computers that exchange data.",
    'guide.internet.toc.1': "What the internet actually is",
    'guide.internet.toc.2': "What happens when you open a website?",
    'guide.internet.toc.3': "Modem, router and Wi-Fi explained",
    'guide.internet.toc.4': "What your internet provider does",
    'guide.internet.toc.5': "How data travels in packets",
    'guide.internet.toc.6': "What affects internet speed?",
    'guide.internet.toc.7': "Key points to remember",
    'guide.internet.heading.definition': "So, what exactly is the internet?",
    'guide.internet.heading.explorer': "Explore the parts of a connection",
    'guide.internet.body.explorer': "Choose a part of the journey. The explanation below changes to show what it does and what can go wrong.",
    'guide.internet.heading.journey': "What happens when you open a website?",
    'guide.internet.body.journey': "Imagine you type a website name into your browser and press Enter. A few things happen very quickly:",
    'guide.internet.heading.equipment': "Modem, router and Wi-Fi: what do they do?",
    'guide.internet.heading.providers': "What does your internet provider do?",
    'guide.internet.heading.packets': "How does information travel?",
    'guide.internet.heading.slow': "Why can your internet feel slow?",
    'guide.internet.heading.takeaways': "The simple version to remember",
    'guide.internet.heading.try': "Try it on your own connection",
    'guide.internet.heading.check': "Want to check your connection?",
    'guide.internet.heading.quiz': "Try it yourself",
    'guide.internet.heading.related': "Keep learning",
    'guide.internet.body.definition.1': "Think of the internet as a huge system of roads connecting computers and devices all over the world. Your phone, your internet provider, a website's computer and millions of other networks are all connected in some way. These connected networks let information travel from one place to another.",
    'guide.internet.body.definition.2': "The internet is not one giant computer in one building. It is made up of many networks run by different organisations. They work together so you can send a message, watch a video, make a payment or visit a website.",
    'guide.internet.body.definition.3': "One useful difference: the internet is the network itself. The web is the collection of websites and pages you open in a browser. Email, online games and video calls also use the internet, but they are not websites.",
    'guide.internet.caption.journey': "A simplified look at how a website request travels from your device to a server and back. The real route can be different.",
    'guide.internet.takeaway.1': "The internet is a worldwide network made up of many connected networks.",
    'guide.internet.takeaway.2': "Websites, email, video calls and games are services that use the internet.",
    'guide.internet.takeaway.3': "Your router connects your home devices; Wi-Fi is just one way they connect to it.",
    'guide.internet.takeaway.4': "DNS helps your device find the right website address.",
    'guide.internet.takeaway.5': "Real-world speed depends on more than the plan you pay for.",
    'guide.internet.explorer.label': "Choose a network component",
    'guide.internet.explorer.device': "Your device",
    'guide.internet.explorer.device.help': "Phone, laptop or TV",
    'guide.internet.explorer.wifi': "Wi-Fi / Ethernet",
    'guide.internet.explorer.wifi.help': "Your local connection",
    'guide.internet.explorer.router': "Router",
    'guide.internet.explorer.router.help': "Directs home traffic",
    'guide.internet.explorer.provider': "Internet provider",
    'guide.internet.explorer.provider.help': "Connects networks",
    'guide.internet.explorer.dns': "DNS",
    'guide.internet.explorer.dns.help': "Finds the destination",
    'guide.internet.explorer.server': "Website server",
    'guide.internet.explorer.server.help': "Returns page data",
    'guide.internet.explorer.impact': "What can affect it?",
    'guide.internet.explorer.footnote': "This is a simplified learning model. DNS lookups can happen at different points, and real traffic may use caches or nearby content servers.",
    'guide.internet.body.speed.wifi': "Wi-Fi signal: distance, thick walls, floors and interference can weaken the wireless connection.",
    'guide.internet.body.speed.devices': "Too many active devices: several people streaming, gaming or downloading at once can share the available capacity.",
    'guide.internet.body.speed.device': "Your device: an older phone, laptop or network adapter may not be able to use the full connection speed.",
    'guide.internet.body.speed.provider': "Your provider's network: busy networks can sometimes slow things down.",
    'guide.internet.body.speed.website': "The website or service: a slow server or a long route can make one website feel slow even when other sites work well.",
    'guide.internet.body.speed.response': "Response delays: a connection can download files quickly but still take longer to respond when you click or play a game.",
    'guide.internet.body.speed.test': "To start checking, run a speed test near your router. If possible, compare it with a wired Ethernet test and repeat at another time. TEZZ CONNECT measures your browser's connection to a TEZZ test endpoint. It is a useful snapshot of that route—not a promise of the speed every website will deliver.",
    'guide.internet.body.try': "Run a test near your router, then try again from the room where you usually use the internet. Note whether you used Wi-Fi or a cable. That small comparison can help you spot a home Wi-Fi issue.",
    'guide.internet.body.check': "Use the free TEZZ CONNECT test to see download speed, upload speed and browser response-time estimates.",
    'guide.internet.cta.speed': "Open TEZZ CONNECT speed test →",
    'guide.internet.quiz.question': "You turn off your home internet service, but your phone and wireless printer can still connect to the same Wi-Fi router. Why?",
    'guide.internet.quiz.legend': "Choose one answer",
    'guide.internet.quiz.option.0': "Wi-Fi and the internet are exactly the same thing.",
    'guide.internet.quiz.option.1': "Wi-Fi connects devices locally; the internet is a separate connection beyond your home network.",
    'guide.internet.quiz.option.2': "Your printer is secretly using mobile data.",
    'guide.internet.quiz.check': "Check my answer",
    'guide.internet.quiz.noscript': "JavaScript is needed to check your answer interactively. The guide above contains the explanation.",
    'guide.internet.related.intro': "Build on this topic with these practical TEZZ CONNECT guides.",
    'guide.internet.related.speed.title': "Internet speed explained",
    'guide.internet.related.speed.description': "Understand bandwidth, downloads and uploads.",
    'guide.internet.related.wifi.title': "Improve Wi-Fi speed",
    'guide.internet.related.wifi.description': "Work through practical coverage and connection checks.",
    'guide.internet.related.latency.title': "Latency, ping and jitter",
    'guide.internet.related.latency.description': "Learn why response time matters.",
    'guide.internet.related.read': "Read guide →",
    'guide.internet.body.journey.device': "Your device connects. Your phone or laptop uses Wi-Fi, an Ethernet cable or mobile data to reach a network.",
    'guide.internet.body.journey.dns': "The website name is looked up. DNS (the Domain Name System) works a bit like your phone's contacts list. It helps find the network address linked to a name such as example.com.",
    'guide.internet.body.journey.route': "Your request travels across networks. Your router and internet provider help send the request towards the computer that hosts the website. The route can vary.",
    'guide.internet.body.journey.reply': "The website sends information back. The server replies with the files needed for the page.",
    'guide.internet.body.journey.browser': "Your browser puts the page together. It uses those files—text, pictures, styles and other parts—to show the website on your screen.",
    'guide.internet.body.cdn': "This is the simple version. Large websites may use several servers, saved copies of files (caches) and content delivery networks to load pages faster.",
    'guide.internet.equipment.modem': "Modem or fibre ONT",
    'guide.internet.body.modem': "This is the equipment that connects your home to the provider's network. Cable or DSL services often use a modem. Fibre services commonly use a device called an ONT. Sometimes these parts are built into one box with the router.",
    'guide.internet.equipment.router': "Router",
    'guide.internet.body.router': "Your router connects the devices in your home to each other and to the internet. It directs information to the right device. Many home routers also provide Wi-Fi and have Ethernet ports for wired connections.",
    'guide.internet.equipment.wifi': "Wi-Fi",
    'guide.internet.body.wifi': "Wi-Fi is simply a wireless way for your phone, laptop or TV to connect to your home network. It is not the internet itself. For example, your phone may still connect to your printer over Wi-Fi even if your internet provider has an outage.",
    'guide.internet.body.isp': "Your internet service provider (ISP) connects your home or office to its network and helps your data reach other networks. It may use fibre, cable, DSL, fixed wireless or a mobile network to provide the connection.",
    'guide.internet.body.plan': "The speed written on your plan is the service level you have subscribed to. It does not mean every app or website will always run at exactly that speed. Your Wi-Fi, device, network traffic, website server and the route your data takes can all affect what you experience.",
    'guide.internet.body.packets': "When you send a photo or open a website, the information is usually broken into smaller pieces called packets. Think of sending a large parcel as several smaller packages. Network equipment reads the address information on each packet and forwards it towards the right destination.",
    'guide.internet.body.reassembly': "The receiving device puts the pieces back together. Some types of internet traffic can resend missing pieces; other types use different methods because speed or timing matters more. You do not need to manage any of this yourself—your devices and network handle it.",
    'guide.speed.caption.directions': "Download brings information to your device. Upload sends information from your device. The illustration is simplified.",
    'guide.speed.read.latency_heading': "Latency: how quickly does a response come back?",
    'guide.speed.body.latency': "Latency is about waiting time, not how much data can move each second. It can affect how responsive a website, game or video call feels. A connection can deliver a large file quickly but still feel sluggish when small requests take a long time to get a response. Read more in our guide to latency, ping and jitter.",
    'guide.speed.read.jitter_heading': "Jitter and packet loss: is the connection consistent?",
    'guide.speed.read.variation_heading': "Why one test may show a different result from another",
    'guide.speed.read.server': "Different test servers: each server may be in a different location or have a different capacity.",
    'guide.speed.read.wifi': "Wi-Fi versus Ethernet: wireless interference and signal strength can change the result.",
    'guide.speed.read.activity': "Other activity: cloud backups, streaming and downloads share your connection.",
    'guide.speed.read.device': "Device limits: older hardware, browser extensions or background tasks may affect testing.",
    'guide.speed.read.time': "Time of day: local network demand and wider provider traffic can vary.",
    'guide.speed.read.bandwidth': "Bandwidth: how much data a connection could carry under suitable conditions.",
    'guide.speed.read.throughput': "Throughput: how much data is actually transferred per second in a particular test or activity.",
    'guide.speed.read.latency_term': "Latency: how long a request takes to receive a response.",
    'guide.speed.read.jitter_term': "Jitter: how much packet or response timing varies.",
    'guide.speed.read.loss': "Packet loss: the share of packets that fail to reach their destination.",
    'guide.speed.quiz.noscript': "JavaScript is needed to check your answer interactively. The guide above contains the explanation.",
    'guide.speed.faq.heading': "Common questions about internet speed",
  };
  const attributeNames = ['aria-label', 'aria-description', 'placeholder', 'title', 'alt'];
  const originalAttributes = new WeakMap();

  function translationFor(key) {
    const bundle = localeBundles[language] || {};
    const legacy = copy[language] || {};
    if (language !== 'en' && typeof bundle[key] === 'string') return bundle[key];
    if (language !== 'en' && typeof legacy[key] === 'string') return legacy[key];
    return typeof sourceStrings[key] === 'string' ? sourceStrings[key] : key;
  }

  function applyKeyedTranslations(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    const elements = [];
    if (root.matches && root.matches('[data-i18n], [data-i18n-aria-label], [data-i18n-aria-description], [data-i18n-placeholder], [data-i18n-title], [data-i18n-alt]')) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll('[data-i18n], [data-i18n-aria-label], [data-i18n-aria-description], [data-i18n-placeholder], [data-i18n-title], [data-i18n-alt]'));
    elements.forEach(element => {
      if (element.hasAttribute('data-i18n')) {
        const key = element.getAttribute('data-i18n');
        if (key && !element.children.length) {
          if (!originals.has(element)) originals.set(element, element.textContent);
          const translated = language === 'en' ? originals.get(element) : translationFor(key);
          if (element.textContent !== translated) element.textContent = translated;
        }
      }
      attributeNames.forEach(attribute => {
        const dataName = 'data-i18n-' + attribute.replace(/^aria-/, 'aria-');
        if (!element.hasAttribute(dataName)) return;
        let saved = originalAttributes.get(element);
        if (!saved) { saved = Object.create(null); originalAttributes.set(element, saved); }
        if (!(attribute in saved)) saved[attribute] = element.getAttribute(attribute) || '';
        const key = element.getAttribute(dataName);
        const translated = language === 'en' ? saved[attribute] : translationFor(key);
        if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
      });
    });
  }
  function translateText(root) {
    if (language === 'en') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (originals.has(node)) node.nodeValue = originals.get(node);
      }
      return;
    }
    const dictionary = { ...(copy[language] || {}), ...(localeBundles[language] || {}) };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|OPTION)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-no-translate],[data-i18n],script,style,code,pre')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      const original = originals.get(node);
      const trimmed = original.trim();
      const replacement = dictionary[trimmed] || original;
      if (node.nodeValue !== replacement) node.nodeValue = replacement;
    });
  }
  function addPicker() {
    const host = document.querySelector('.head-inner');
    if (!host || host.querySelector('[data-tezz-language-picker]')) return;
    const label = document.createElement('label');
    label.dataset.tezzLanguagePicker = 'true';
    label.setAttribute('aria-label', 'Choose website language');
    label.setAttribute('data-i18n-aria-label', 'common.choose_language');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-inline-start:12px;font:600 12px/1.2 system-ui,sans-serif;color:inherit;white-space:nowrap';
    const icon = document.createElement('span');
    icon.textContent = '文';
    icon.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Website language');
    select.setAttribute('data-i18n-aria-label', 'common.language');
    select.style.cssText = 'max-width:132px;padding:8px 26px 8px 9px;border:1px solid #6c8799;border-radius:9px;background:#10283e;color:#fff;font:600 12px system-ui,sans-serif';
    languages.forEach(item => {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.nativeName || item.name;
      select.append(option);
    });
    select.value = language;
    select.addEventListener('change', () => { setLanguage(select.value); });
    label.append(icon, select);
    host.append(label);
  }
  async function setLanguage(next) {
    const requested = supported.has(next) ? next : 'en';
    if (requested !== 'en' && !localeBundles[requested]) {
      const locale = languages.find(item => item.code === requested);
      if (!locale || !locale.bundle) {
        language = requested;
      } else {
      try {
        const response = await fetch(locale.bundle, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Locale bundle unavailable');
        const bundle = await response.json();
        if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('Invalid locale bundle');
        localeBundles[requested] = bundle;
      } catch {
        const picker = document.querySelector('[data-tezz-language-picker] select');
        if (picker) picker.value = language;
        return;
      }
      }
    }
    language = requested;
    try { localStorage.setItem(KEY, language); } catch {}
    document.documentElement.lang = language;
    document.documentElement.dir = directions.get(language) || 'ltr';
    const picker = document.querySelector('[data-tezz-language-picker] select');
    if (picker) picker.value = language;
    translateText(document.body);
    applyKeyedTranslations(document.body);
    document.dispatchEvent(new CustomEvent('tezz-language-change', { detail: { language } }));
  }
  async function loadLocaleManifest() {
    try {
      const response = await fetch('/locales/manifest.json', { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) return;
      const manifest = await response.json();
      if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.locales)) return;
      const valid = manifest.locales.filter(item =>
        item && typeof item.code === 'string' &&
        /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/.test(item.code) &&
        typeof item.nativeName === 'string' && item.nativeName.trim() &&
        ['ltr', 'rtl'].includes(item.direction || 'ltr') &&
        item.status === 'published' &&
        (copy[item.code] || (typeof item.bundle === 'string' && item.bundle.startsWith('/locales/') && !item.bundle.includes('..')))
      );
      if (!valid.some(item => item.code === 'en')) return;
      languages = valid.map(item => ({
        code: item.code,
        name: item.name || item.nativeName,
        nativeName: item.nativeName,
        direction: item.direction || 'ltr',
        bundle: item.bundle || null
      }));
      supported = new Set(languages.map(item => item.code));
      directions = new Map(languages.map(item => [item.code, item.direction]));
      if (window.TEZZLanguage) window.TEZZLanguage.languages = languages;
    } catch {
      // Keep the embedded starter registry if the static manifest is unavailable.
    }
  }
  async function init() {
    await loadLocaleManifest();
    const savedLanguage = readLanguage();
    language = 'en';
    if (savedLanguage !== 'en') await setLanguage(savedLanguage);
    document.documentElement.lang = language;
    document.documentElement.dir = directions.get(language) || 'ltr';
    addPicker();
    translateText(document.body);
    applyKeyedTranslations(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateText(node);
            applyKeyedTranslations(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            translateText(node.parentElement || document.body);
            applyKeyedTranslations(node.parentElement || document.body);
          }
        });
        else if (record.type === 'characterData') {
          translateText(record.target.parentElement || document.body);
          applyKeyedTranslations(record.target.parentElement || document.body);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('storage', event => {
      if (event.key === KEY) setLanguage(event.newValue || 'en');
    });
  }
  // Publish the helper synchronously so inline guide scripts can translate
  // their first render before DOMContentLoaded and the manifest fetch finish.
  window.TEZZLanguage = {
    setLanguage,
    getLanguage: () => language,
    getLanguages: () => languages.slice(),
    t: translationFor,
    apply: root => applyKeyedTranslations(root || document.body),
    languages
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();