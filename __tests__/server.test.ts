import http from "http";
import request from "supertest";
import { app, connectionPromise } from "../src/server";
import { Connection, Repository } from "typeorm";
import { User, Entry } from "../src/entities";

let connection: Connection;
let server: http.Server;

interface IIncompletePayload {
  [index: string]: string;
}

beforeEach(async () => {
  connection = await connectionPromise;
  console.log(
    `Establishing a connection (named "${connection.name}) to the DB - successful.`
  );

  const dropBeforeSync = true;
  await connection.synchronize(dropBeforeSync);
  console.log("Synchronizing the DB schema - successful.");

  const PORT_FOR_TESTING: number = 3001;
  server = app.listen(PORT_FOR_TESTING, async () => {
    console.log(`Server listening on port ${PORT_FOR_TESTING} ...`);
  });
});

afterEach((done) => {
  server.close();
  done();
});

describe("POST /api/users", () => {
  test(
    "if a client request doesn't include a 'Content-Type: application/json' header," +
      " the server should respond with a 400",
    async () => {
      const response = await request(server)
        .post("/api/users")
        .set("Content-Type", "text/html");

      expect(response.status).toEqual(400);
      expect(response.type).toEqual("application/json");
      expect(response.body).toEqual({
        error: "Your request did not include a 'Content-Type: application/json' header",
      });
    }
  );

  test(
    "if a client doesn't send all required fields," +
      " the server should respond with a 400",
    async () => {
      const completeUserPayload = {
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      };

      for (let field in completeUserPayload) {
        let incompleteUserPayload: IIncompletePayload = { ...completeUserPayload };
        delete incompleteUserPayload[field];

        const response = await request(server)
          .post("/api/users")
          .send(incompleteUserPayload);

        expect(response.status).toEqual(400);
        expect(response.type).toEqual("application/json");
        expect(response.body).toEqual({
          error: `Your request body did not specify a '${field}'`,
        });
      }
    }
  );

  test(
    "if a client requests to create a new User resource," +
      " the server should create that resource",
    async () => {
      const response = await request(server).post("/api/users").send({
        username: "ms",
        name: "Mary Smith",
        email: "mary.smith@protonmail.com",
        password: "456",
      });

      expect(response.status).toEqual(201);
      expect(response.headers.location).toEqual("/api/users/1");
      expect(response.type).toEqual("application/json");
      expect(response.body).toEqual({
        id: 1,
        username: "ms",
      });

      const usersRepository: Repository<User> = connection.getRepository(User);
      const users = await usersRepository.find();
      expect(users.length).toEqual(1);
      const { id, username, name, email, password } = users[0];
      expect({
        id,
        username,
        name,
        email,
        password,
      }).toEqual({
        id: 1,
        username: "ms",
        name: "Mary Smith",
        email: "mary.smith@protonmail.com",
        password: "456",
      });
    }
  );

  test(
    "if a client requests to create a new User resource" +
      " with a username which coincides with that of an existing User," +
      " the server should respond with a 400",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server).post("/api/users").send({
        username: "jd",
        name: "different-name",
        email: "different-email",
        password: "different-password",
      });

      expect(response2.status).toEqual(400);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        error:
          "There already exists a User resource with the username that you provided",
      });

      const usersRepository: Repository<User> = connection.getRepository(User);
      const users: User[] = await usersRepository.find();
      expect(users.length).toEqual(1);
      expect(users[0].name).toEqual("John Doe");
    }
  );

  test(
    "if a client requests to create a new User resource" +
      " with an email which coincides with that of an existing User," +
      " the server should respond with a 400",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server).post("/api/users").send({
        username: "different-username",
        name: "different-name",
        email: "john.doe@protonmail.com",
        password: "different-password",
      });

      expect(response2.status).toEqual(400);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        error: "There already exists a User resource with the email that you provided",
      });

      const usersRepository: Repository<User> = connection.getRepository(User);
      const users: User[] = await usersRepository.find();
      expect(users.length).toEqual(1);
      expect(users[0].name).toEqual("John Doe");
    }
  );

  test(
    "if the username, name, and/or email provided by the client" +
      " contain leading and trailing whitespace characters," +
      " those characters are removed before a new User resource is inserted into the DB",
    async () => {
      const response = await request(server).post("/api/users").send({
        username: " jd ",
        name: " John Doe ",
        email: " john.doe@protonmail.com ",
        password: " 123 ",
      });
      expect(response.status).toEqual(201);

      const usersRepository: Repository<User> = connection.getRepository(User);
      const user = await usersRepository.findOne({ id: 1 });
      // At this point, we know from external means - namely, from the fact that the
      // issued request was a successful one - that `user` is not `null` or `undefined`.
      // Therefore, we can use the "non-null assertion operator" `!` to coerce away
      // those types:
      expect({
        username: user!.username,
        name: user!.name,
        email: user!.email,
        password: user!.password,
      }).toEqual({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: " 123 ",
      });
    }
  );
});

describe("GET /api/users", () => {
  test(
    "if a client requests all User resources but there are no User resources," +
      " the server should respond with an empty list",
    async () => {
      const response = await request(server).get("/api/users");

      expect(response.status).toEqual(200);
      expect(response.type).toEqual("application/json");
      expect(response.body).toEqual({
        users: [],
      });
    }
  );

  test(
    "if a client requests all User resources," +
      " the server should respond with public representations of all of them",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server).get("/api/users");

      expect(response2.status).toEqual(200);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        users: [{ id: 1, username: "jd" }],
      });
    }
  );
});

describe("GET /api/users/:id", () => {
  test(
    "if a client specifies a non-existent User ID," +
      " the server should respond with a 404",
    async () => {
      const response = await request(server).get("/api/users/1");

      expect(response.status).toEqual(404);
      expect(response.type).toEqual("application/json");
      expect(response.body).toEqual({
        error: "There doesn't exist a User resource with an ID of 1",
      });
    }
  );

  test(
    "if a client specifies an existing User ID," +
      "the server should respond with (a public representation of) that User resource",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server).get("/api/users/1");

      expect(response2.status).toEqual(200);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        id: 1,
        username: "jd",
      });
    }
  );
});

describe("PUT /api/users/:id", () => {
  test(
    "if a client attempts to" +
      " edit a User resource without providing Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server).put("/api/users/1").send({
        username: "jd-s-new-username",
      });

      expect(response2.status).toEqual(401);
      expect(response2.body).toEqual({
        error: "authentication required - via Basic authentication",
      });
    }
  );

  test(
    "if a client attempts to" +
      " edit a User resource by providing an invalid set of Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server)
        .put("/api/users/1")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:wrong-password"))
        .send({
          username: "jd-s-new-username",
        });

      expect(response2.status).toEqual(401);
      expect(response2.body).toEqual({
        error: "authentication required - incorrect email and/or password",
      });
    }
  );

  test(
    "if a client requests to edit a User resource without including a" +
      " 'Content-Type: application/json' header," +
      " the server should respond with a 400",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server)
        .put("/api/users/1")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .set("Content-Type", "text/html");

      expect(response2.status).toEqual(400);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        error: "Your request did not include a 'Content-Type: application/json' header",
      });
    }
  );

  test(
    "if a client attempts to edit a User resource," +
      " which doesn't correspond to the user authenticated by the issued request's" +
      " header," +
      " the server should respond with a 403",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server)
        .put("/api/users/2")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .set("Content-Type", "application/json")
        .send({
          username: "new-username",
          name: "new-name",
          email: "new-email",
          password: "new-password",
        });

      expect(response2.status).toEqual(403);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        error: "You are not allowed to edit any User resource different from your own",
      });
    }
  );

  test(
    "if a client requests to edit a User resource in such a way that its new" +
      " username (or email) would end up being the same as that of another User" +
      " resource, the server should respond with a 400",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "ms",
          name: "Mary Smith",
          email: "mary.smith@protonmail.com",
          password: "456",
        });

      // Attempt to edit the 1st User resource in such a way that its new username would
      // end up being the same as that of the 2nd User resource.
      const response3 = await request(server)
        .put("/api/users/1")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .set("Content-Type", "application/json")
        .send({ username: "ms" });

      expect(response3.status).toEqual(400);
      expect(response3.type).toEqual("application/json");
      expect(response3.body).toEqual({
        error: "There already exists a User resource with a username of 'ms'",
      });

      // Attempt to edit the 1st User resource in such a way that its new email would
      // end up being the same as that of the 2nd User resource.
      const response4 = await request(server)
        .put("/api/users/1")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .set("Content-Type", "application/json")
        .send({ email: "mary.smith@protonmail.com" });

      expect(response4.status).toEqual(400);
      expect(response4.type).toEqual("application/json");
      expect(response4.body).toEqual({
        error:
          "There already exists a User resource with an email of" +
          " 'mary.smith@protonmail.com'",
      });
    }
  );

  test(
    "if a client specifies an existing User ID and provides a request body, which" +
      " doesn't duplicate another User resource's username or email, the server" +
      " should edit the targeted User resource",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "original-username",
          name: "original-name",
          email: "original-email",
          password: "original-password",
        });

      const response2 = await request(server)
        .put("/api/users/1")
        .set("Authorization", "Basic " + btoa("original-email:original-password"))
        .set("Content-Type", "application/json")
        .send({
          username: "new-username",
          name: "new-name",
          email: "new-email",
          password: "new-password",
        });

      expect(response2.status).toEqual(200);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        id: 1,
        username: "new-username",
      });

      const usersRepository: Repository<User> = connection.getRepository(User);
      const u = await usersRepository.findOne({ id: 1 });
      // At this point, we know from external means - namely, from the fact that both
      // of the issued requests were successful ones - that `u` is not `null` or
      // `undefined`. Therefore, we can use the "non-null assertion operator" `!` to
      // coerce away those types:
      expect({
        id: u!.id,
        username: u!.username,
        name: u!.name,
        email: u!.email,
        password: u!.password,
      }).toEqual({
        id: 1,
        username: "new-username",
        name: "new-name",
        email: "new-email",
        password: "new-password",
      });
    }
  );

  test(
    "if the username, name, and/or email provided by the client" +
      " contain leading and trailing whitespace characters," +
      " those characters are removed" +
      " before the targeted User resource is updated in the DB",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });
      expect(response1.status).toEqual(201);

      const response2 = await request(server)
        .put("/api/users/1")
        .set("Authorization", "Bearer " + btoa("john.doe@protonmail.com:123"))
        .send({
          username: " ms ",
          name: " Mary Smith ",
          email: " mary.smith@protonmail.com ",
          password: " 456 ",
        });
      expect(response2.status).toEqual(200);

      const usersRepository: Repository<User> = connection.getRepository(User);
      const user = await usersRepository.findOne({ id: 1 });
      // At this point, we know from external means - namely, from the fact that both
      // of the issued requests were successful ones - that `user` is not `null` or
      // `undefined`. Therefore, we can use the "non-null assertion operator" `!` to
      // coerce away those types:
      expect({
        username: user!.username,
        name: user!.name,
        email: user!.email,
        password: user!.password,
      }).toEqual({
        username: "ms",
        name: "Mary Smith",
        email: "mary.smith@protonmail.com",
        password: " 456 ",
      });
    }
  );
});

describe("DELETE /api/users/:id", () => {
  test(
    "if a client attempts to" +
      " delete a User resource without providing Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server).delete("/api/users/1");

      expect(response2.status).toEqual(401);
      expect(response2.body).toEqual({
        error: "authentication required - via Basic authentication",
      });
    }
  );

  test(
    "if a client attempts to" +
      " delete a User resource by providing an invalid set of Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server)
        .delete("/api/users/1")
        .set(
          "Authorization",
          "Basic " + btoa("john.doe@protonmail.com:wrong-password")
        );

      expect(response2.status).toEqual(401);
      expect(response2.body).toEqual({
        error: "authentication required - incorrect email and/or password",
      });
    }
  );

  test(
    "if a client attempts to delete a User resource," +
      " which doesn't correspond to the user authenticated by the issued request's" +
      " header," +
      " the server should respond with a 403",
    async () => {
      const reponse1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server)
        .delete("/api/users/2")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"));

      expect(response2.status).toEqual(403);
      expect(response2.type).toEqual("application/json");
      expect(response2.body).toEqual({
        error:
          "You are not allowed to delete any User resource different from your own",
      });
    }
  );

  test(
    "if a client requests to delete an existing User resource," +
      " the server should delete that resource",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server)
        .delete("/api/users/1")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"));

      expect(response2.status).toEqual(204);
      expect(response2.body).toEqual({});
    }
  );
});

describe("POST /api/entries", () => {
  test(
    "if a client attempts to" +
      " create an Entry resource without providing Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response1 = await request(server)
        .post("/api/users")
        .set("Content-Type", "application/json")
        .send({
          username: "jd",
          name: "John Doe",
          email: "john.doe@protonmail.com",
          password: "123",
        });

      const response2 = await request(server).post("/api/entries").send({
        timezone: "+02:00",
        localTime: "2021-01-01 02:00:17",
        content: "Happy New Year to everybody in the UK!",
      });

      expect(response2.status).toEqual(401);
      expect(response2.body).toEqual({
        error: "authentication required - via Basic authentication",
      });
    }
  );

  test(
    "if a client attempts to create an Entry resource without including a" +
      " 'Content-Type: application/json' header," +
      " the server should respond with a 400",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server)
        .post("/api/entries")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .set("Content-Type", "text/html");

      expect(response2.status).toEqual(400);
      expect(response2.body).toEqual({
        error: "Your request did not include a 'Content-Type: application/json' header",
      });
    }
  );

  test(
    "if a client doesn't send all required fields," +
      " the server should respond with a 400",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const completeEntryPayload = {
        timezone: "+02:00",
        localTime: "2021-01-01 02:00:17",
        content: "Happy New Year to everybody in the UK!",
      };

      for (let field in completeEntryPayload) {
        let incompleteEntryPayload: IIncompletePayload = { ...completeEntryPayload };
        delete incompleteEntryPayload[field];

        const response2 = await request(server)
          .post("/api/entries")
          .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
          .send(incompleteEntryPayload);

        expect(response2.status).toEqual(400);
        expect(response2.type).toEqual("application/json");
        expect(response2.body).toEqual({
          error: `Your request body did not specify a '${field}'`,
        });
      }
    }
  );

  test(
    "if a client issues a valid request for creating an Entry resource," +
      " then the server should create that resource",
    async () => {
      const response1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const response2 = await request(server)
        .post("/api/entries")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .send({
          timezone: "+02:00",
          localTime: "2021-01-01 02:00:17",
          content: "Happy New Year to everybody in the UK!",
        });

      expect(response2.status).toEqual(201);
      expect(response2.headers.location).toEqual("/api/entries/1");
      expect(response2.type).toEqual("application/json");

      const response2Body = {
        id: response2.body.id,
        timestampInUTC: response2.body.timestampInUTC,
        utcZoneOfTimestamp: response2.body.utcZoneOfTimestamp,
        content: response2.body.content,
        userId: response2.body.userId,
      };
      expect(response2Body).toEqual({
        id: 1,
        timestampInUTC: "2021-01-01T00:00:17.000Z",
        utcZoneOfTimestamp: "+02:00",
        content: "Happy New Year to everybody in the UK!",
        userId: 1,
      });
    }
  );
});

describe("GET /api/entries", () => {
  test(
    "if a client requests all Entry resources" +
      " without providing Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response = await request(server).get("/api/entries");

      expect(response.status).toEqual(401);
      expect(response.body).toEqual({
        error: "authentication required - via Basic authentication",
      });
    }
  );

  test(
    "if a client issues a valid request," +
      " the server should respond with a list of all Entry resources" +
      " that are associated with the user authenticated by the issued request's header",
    async () => {
      // Create two User resources, as well as one Entry resource per user.
      const responseUser1 = await request(server).post("/api/users").send({
        username: "jd",
        name: "John Doe",
        email: "john.doe@protonmail.com",
        password: "123",
      });

      const responseUser2 = await request(server).post("/api/users").send({
        username: "ms",
        name: "Mary Smith",
        email: "mary.smith@protonmail.com",
        password: "456",
      });

      const responseEntry1 = await request(server)
        .post("/api/entries")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
        .send({
          timezone: "+02:00",
          localTime: "2021-01-01 02:00:17",
          content: "Happy New Year to everybody in the UK!",
        });

      const responseEntry2 = await request(server)
        .post("/api/entries")
        .set("Authorization", "Basic " + btoa("mary.smith@protonmail.com:456"))
        .send({
          timezone: "-05:00",
          localTime: "2020-12-31 19:00:17",
          content: "Happy New Year to everybody in the UK!",
        });

      // Get all Entry resources that are associated with the 1st user.
      const response = await request(server)
        .get("/api/entries")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"));

      expect(response.status).toEqual(200);

      const responseBody = {
        entries: response.body.entries.map((entry: Entry) => {
          const { id, timestampInUTC, utcZoneOfTimestamp, content, userId } = entry;
          return { id, timestampInUTC, utcZoneOfTimestamp, content, userId };
        }),
      };
      expect(responseBody).toEqual({
        entries: [
          {
            id: 1,
            timestampInUTC: "2021-01-01T00:00:17.000Z",
            utcZoneOfTimestamp: "+02:00",
            content: "Happy New Year to everybody in the UK!",
            userId: 1,
          },
        ],
      });
    }
  );
});

describe("GET /api/entries/:id", () => {
  beforeEach(async () => {
    /*
    Create two User resources, as well as one Entry resource per user.
    */

    const responseUser1 = await request(server).post("/api/users").send({
      username: "jd",
      name: "John Doe",
      email: "john.doe@protonmail.com",
      password: "123",
    });

    const responseUser2 = await request(server).post("/api/users").send({
      username: "ms",
      name: "Mary Smith",
      email: "mary.smith@protonmail.com",
      password: "456",
    });

    const responseEntry1 = await request(server)
      .post("/api/entries")
      .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"))
      .send({
        timezone: "+02:00",
        localTime: "2021-01-01 02:00:17",
        content: "Happy New Year to everybody in the UK!",
      });

    const responseEntry2 = await request(server)
      .post("/api/entries")
      .set("Authorization", "Basic " + btoa("mary.smith@protonmail.com:456"))
      .send({
        timezone: "-05:00",
        localTime: "2020-12-31 19:00:17",
        content: "Happy New Year to everybody in the UK!",
      });
  });

  test(
    "if a client attempts to" +
      " fetch an Entry resource without providing Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response = await request(server).get("/api/entries/1");

      expect(response.status).toEqual(401);
      expect(response.body).toEqual({
        error: "authentication required - via Basic authentication",
      });
    }
  );

  test(
    "if a client attempts to fetch an Entry resource, which doesn't exist," +
      " the server should respond with a 404",
    async () => {
      const response = await request(server)
        .get("/api/entries/17")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"));

      expect(response.status).toEqual(404);
      expect(response.body).toEqual({
        error: "Your User doesn't have an Entry resource with an ID of 17",
      });
    }
  );

  test(
    "if a client attempts to fetch an Entry resource, which does exist," +
      " by providing an invalid set of Basic Auth credentials," +
      " the server should respond with a 401",
    async () => {
      const response = await request(server)
        .get("/api/entries/1")
        .set(
          "Authorization",
          "Basic " + btoa("john.doe@protonmail.com:wrong-password")
        );

      expect(response.status).toEqual(401);
      expect(response.body).toEqual({
        error: "authentication required - incorrect email and/or password",
      });
    }
  );

  test(
    "if a client attempts to fetch an Entry resource," +
      " which does exist but" +
      " isn't associated with the user authenticated by the issued request's header," +
      " the server should respond with a 404",
    async () => {
      const response = await request(server)
        .get("/api/entries/2")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"));

      expect(response.status).toEqual(404);
      expect(response.body).toEqual({
        error: "Your User doesn't have an Entry resource with an ID of 2",
      });
    }
  );

  test(
    "if a client issues a valid request for fetching an Entry resource," +
      " then the server should respond with that resource",
    async () => {
      const response = await request(server)
        .get("/api/entries/1")
        .set("Authorization", "Basic " + btoa("john.doe@protonmail.com:123"));

      expect(response.status).toEqual(200);

      const { id, timestampInUTC, utcZoneOfTimestamp, content, userId } = response.body;
      const responseBody = { id, timestampInUTC, utcZoneOfTimestamp, content, userId };
      expect(responseBody).toEqual({
        id: 1,
        timestampInUTC: "2021-01-01T00:00:17.000Z",
        utcZoneOfTimestamp: "+02:00",
        content: "Happy New Year to everybody in the UK!",
        userId: 1,
      });
    }
  );
});
