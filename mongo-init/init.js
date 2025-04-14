db = db.getSiblingDB('chatdb');

db.rooms.insertMany([
  {
    _id: ObjectId("67e7358e84ed0464f58adf95"),
    id: "general",
    name: "General",
    image: "general.jpg",
    defaultMessage: "Welcome to the General room of Cursor.Style, where you can chat about any topic under the sun! If you're looking for something more specific, feel free to explore other rooms.",
    isReadOnly: false,
    createdAt: ISODate("2025-03-28T23:49:34.906Z")
  },
  {
    _id: ObjectId("67e7360784ed0464f58adf96"),
    id: "gaming",
    name: "Gaming",
    image: "gaming.jpg",
    defaultMessage: "Welcome to the Gaming Room! 🎮 This is your fun place to talk about all your favorite games! Share cool tricks, tell us about your best adventures, or just chat with friends who love gaming too.",
    isReadOnly: false,
    createdAt: ISODate("2025-03-28T23:51:35.056Z")
  },
  {
    _id: ObjectId("67e7363084ed0464f58adf97"),
    id: "news",
    name: "Latest News",
    image: "news.jpg",
    defaultMessage: "📰 Latest announcements will appear here.",
    isReadOnly: true,
    createdAt: ISODate("2025-03-28T23:52:16.757Z")
  },
  {
    _id: ObjectId("67f000000000000000000001"),
    id: "school",
    name: "School Room",
    image: "school.jpg",
    defaultMessage: "🎓 Welcome to the School Room! A place for students to share homework tips, study hacks, and learning fun. Stay curious!",
    isReadOnly: false,
    createdAt: ISODate("2025-04-08T19:00:00.000Z")
  },
  {
    _id: ObjectId("67f000000000000000000002"),
    id: "memes",
    name: "Meme Zone",
    image: "memes.jpg",
    defaultMessage: "🤣 Drop your funniest memes here! Let’s keep the laughter going and good vibes flowing.",
    isReadOnly: false,
    createdAt: ISODate("2025-04-08T19:01:00.000Z")
  },
  {
    _id: ObjectId("67f000000000000000000003"),
    id: "tech",
    name: "Tech Talk",
    image: "tech.jpg",
    defaultMessage: "💻 Welcome to Tech Talk! Share coding projects, ask programming questions, or discuss your favorite frameworks.",
    isReadOnly: false,
    createdAt: ISODate("2025-04-08T19:02:00.000Z")
  },
  {
    _id: ObjectId("67f000000000000000000004"),
    id: "ideas",
    name: "Idea Lab",
    image: "ideas.jpg",
    defaultMessage: "💡 Got a bright idea? Share it here! Brainstorming welcome — no idea is too wild.",
    isReadOnly: false,
    createdAt: ISODate("2025-04-08T19:03:00.000Z")
  },
  {
    _id: ObjectId("67f000000000000000000005"),
    id: "relax",
    name: "Chill & Relax",
    image: "relax.jpg",
    defaultMessage: "🧘 This is your quiet corner. Share peaceful thoughts, relaxing music, or just take a breather.",
    isReadOnly: false,
    createdAt: ISODate("2025-04-08T19:04:00.000Z")
  }
]);

print("✅ Rooms imported into chatdb.rooms");
