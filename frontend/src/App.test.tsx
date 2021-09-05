import "@testing-library/jest-dom";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

import { IState, RequestStatus } from "./types";

import { PrivateRoute } from "./App";
import App from "./App";

import { Provider } from "react-redux";

import { createStore } from "redux";

import { setupServer } from "msw/node";

import thunkMiddleware from "redux-thunk";

import { applyMiddleware } from "redux";

import { createMemoryHistory } from "history";
import { Router, Switch, Route } from "react-router-dom";
import { EditEntry } from "./App";

import { DeleteEntry } from "./App";

import {
  initialStateAlerts,
  JOURNAL_APP_TOKEN,
  initialStateAuth,
  initialStateEntries,
} from "./constants";

import { DefaultRequestBody, MockedRequest, rest, RestHandler } from "msw";

import {
  MOCK_ENTRIES_ENTITIES,
  MOCK_ENTRIES_IDS,
  MOCK_ENTRY_10,
  MOCK_ENTRY_10_LOCAL_TIME,
  MOCK_LINKS,
  MOCK_META,
  requestHandlers,
} from "./testHelpers";

import { rootReducer } from "./store";
import { Alerts } from "./features/alerts/Alerts";
import { SignIn } from "./features/auth/SignIn";
import { JournalEntries } from "./features/entries/JournalEntries";

/* Create an MSW "request-interception layer". */
const requestInterceptionLayer: RestHandler<MockedRequest<DefaultRequestBody>>[] = [
  rest.post("/api/users", requestHandlers.mockMultipleFailures),

  rest.post("/api/tokens", requestHandlers.mockMultipleFailures),

  rest.get("/api/user-profile", requestHandlers.mockMultipleFailures),

  rest.get("/api/entries", requestHandlers.mockMultipleFailures),
  rest.post("/api/entries", requestHandlers.mockMultipleFailures),
  rest.put("/api/entries/:id", requestHandlers.mockMultipleFailures),
  rest.delete("/api/entries/:id", requestHandlers.mockMultipleFailures),
];

const quasiServer = setupServer(...requestInterceptionLayer);

describe("<App>", () => {
  let enhancer: any;
  let initState: IState;
  let history: any;

  beforeAll(() => {
    // Enable API mocking.
    quasiServer.listen();
  });

  beforeEach(() => {
    enhancer = applyMiddleware(thunkMiddleware);

    initState = {
      alerts: {
        ...initialStateAlerts,
      },
      auth: {
        ...initialStateAuth,
      },
      entries: {
        ...initialStateEntries,
      },
    };

    history = createMemoryHistory();
  });

  afterEach(() => {
    quasiServer.resetHandlers();
  });

  afterAll(() => {
    // Disable API mocking.
    quasiServer.close();
  });

  test("initial render (i.e. before/without any user interaction)", async () => {
    const realStore = createStore(rootReducer, enhancer);
    render(
      <Provider store={realStore}>
        <Router history={history}>
          <App />
        </Router>
      </Provider>
    );

    let element: HTMLElement;

    element = await screen.findByText("Home");
    expect(element).toBeInTheDocument();
    element = screen.getByText("Sign In");
    expect(element).toBeInTheDocument();
    element = screen.getByText("Sign Up");
    expect(element).toBeInTheDocument();

    element = screen.getByText("Welcome to JournalEntries!");
    expect(element).toBeInTheDocument();
  });

  test("render after the user has signed in", async () => {
    // Arrange.
    quasiServer.use(
      rest.get("/api/user-profile", requestHandlers.mockFetchUserProfile)
    );

    const realStore = createStore(rootReducer, initState, enhancer);

    // Act.
    render(
      <Provider store={realStore}>
        <Router history={history}>
          <App />
        </Router>
      </Provider>
    );

    // Assert.
    let element: HTMLElement;

    element = await screen.findByText("Sign Out");
    expect(element).toBeInTheDocument();
    element = screen.getByText("JournalEntries");
    expect(element).toBeInTheDocument();
    element = screen.getByText("Home");
    expect(element).toBeInTheDocument();
  });

  test("after the user has signed in, the user clicks on 'Sign Out'", async () => {
    // Arrange.
    quasiServer.use(
      rest.get("/api/user-profile", requestHandlers.mockFetchUserProfile)
    );

    const realStore = createStore(rootReducer, initState, enhancer);

    render(
      <Provider store={realStore}>
        <Router history={history}>
          <App />
        </Router>
      </Provider>
    );

    // Act.
    const signOutAnchor: HTMLElement = await screen.findByText("Sign Out");
    fireEvent.click(signOutAnchor);

    // Assert.
    let element: HTMLElement;

    element = await screen.findByText("SIGN-OUT SUCCESSFUL");
    expect(element).toBeInTheDocument();

    element = screen.getByText("Home");
    expect(element).toBeInTheDocument();
    element = screen.getByText("Sign In");
    expect(element).toBeInTheDocument();
    element = screen.getByText("Sign Up");
    expect(element).toBeInTheDocument();
  });

  test(
    "after the user has signed in, the user clicks on 'Sign Out'" +
      " - that should update the localStorage correctly",
    async () => {
      // Arrange.
      localStorage.setItem(JOURNAL_APP_TOKEN, "a-jws-token-issued-by-the-backend");
      // Strictly speaking, the setup logic for this test case renders
      // the next two statements unnecessary-to-have,
      // but including them is of some instructive value.
      initState.auth.token = localStorage.getItem(JOURNAL_APP_TOKEN);
      initState.auth.hasValidToken = true;

      const realStore = createStore(rootReducer, initState, enhancer);
      render(
        <Provider store={realStore}>
          <Router history={history}>
            <App />
          </Router>
        </Provider>
      );

      // Act.
      const signOutAnchor: HTMLElement = await screen.findByText("Sign Out");
      fireEvent.click(signOutAnchor);

      // Assert.
      expect(localStorage.getItem(JOURNAL_APP_TOKEN)).toEqual(null);
    }
  );

  test(
    "if a user hasn't signed in" +
      " but manually saves a token in their web-browser's localStorage," +
      " the frontend application should display only the following navigation links:" +
      " 'Home', 'Sign In', 'Sign Up'",
    async () => {
      // Arrange.

      // Strictly speaking, the setup logic for this test case renders
      // the next two statements unnecessary-to-have,
      // but including them is of some instructive value.
      localStorage.setItem(JOURNAL_APP_TOKEN, "a-jws-token-NOT-issued-by-the-backend");
      initState.auth.token = localStorage.getItem(JOURNAL_APP_TOKEN);

      const realStore = createStore(rootReducer, initState, enhancer);

      // Act.
      render(
        <Provider store={realStore}>
          <Router history={history}>
            <App />
          </Router>
        </Provider>
      );

      // Assert.
      let element: HTMLElement;

      element = await screen.findByText("TO CONTINUE, PLEASE SIGN IN");
      expect(element).toBeInTheDocument();

      element = screen.getByText("Home");
      expect(element).toBeInTheDocument();
      element = screen.getByText("Sign In");
      expect(element).toBeInTheDocument();
      element = screen.getByText("Sign Up");
      expect(element).toBeInTheDocument();
    }
  );

  xtest(
    "if a user signs in" +
      " and goes on to manually change the URL in her browser's address bar" +
      " to /journal-entries ," +
      " the frontend application should redirect to / (but keep the user signed in)",
    async () => {
      // Arrange.
      quasiServer.use(
        rest.get("/api/user-profile", requestHandlers.mockFetchUserProfile),

        rest.get("/api/entries", requestHandlers.mockFetchEntries),
        rest.get("/api/user-profile", requestHandlers.mockFetchUserProfile)
      );

      const realStore = createStore(rootReducer, initState, enhancer);

      // Act:

      // - navigate to the root URL, and mount the application's entire React tree
      history.push("/");

      const { getByText: getByTextFromRootURL } = render(
        <Provider store={realStore}>
          <Router history={history}>
            <App />
          </Router>
        </Provider>
      );

      let element: HTMLElement;

      element = await screen.findByText("Hello, mocked-John Doe!");
      expect(element).toBeInTheDocument();

      // - unamount React trees that were mounted with render
      cleanup();

      // - navigate to the /journal-entries URL,
      //   and mount the application's entire React tree
      console.log("[the test case is]");
      console.log("navigating to the /journal-entries URL");
      console.log("and mounting the application's entire React tree");

      history.push("/journal-entries");

      render(
        <Provider store={realStore}>
          <Router history={history}>
            <App />
          </Router>
        </Provider>
      );

      // Assert.
      await waitFor(() => {
        expect(history.location.pathname).toEqual("/");
      });

      element = screen.getByText("Hello, mocked-John Doe!");
      expect(element).toBeInTheDocument();
    }
  );

  test(
    "if a user hasn't signed in" +
      " but manually changes the URL in her browser's address bar" +
      " to /journal-entries ," +
      " the frontend application should redirect the user to /sign-in",
    async () => {
      // Arrange.
      const realStore = createStore(rootReducer, initState, enhancer);

      // Act.
      history.push("/journal-entries");

      render(
        <Provider store={realStore}>
          <Router history={history}>
            <App />
          </Router>
        </Provider>
      );

      // Assert.
      expect(history.location.pathname).toEqual("/sign-in");

      const elements = screen.queryAllByText("Review JournalEntries!");
      expect(elements.length).toEqual(0);
    }
  );
});

describe("<EditEntry>", () => {
  let history;
  let realStore;

  beforeEach(() => {
    const initState: IState = {
      alerts: {
        ...initialStateAlerts,
      },
      auth: {
        ...initialStateAuth,
        requestStatus: RequestStatus.SUCCEEDED,
        token: "token-issued-by-the-backend",
        hasValidToken: true,
      },
      entries: {
        ...initialStateEntries,
        requestStatus: RequestStatus.SUCCEEDED,
        ids: [MOCK_ENTRY_10.id],
        entities: {
          [MOCK_ENTRY_10.id]: MOCK_ENTRY_10,
        },
      },
    };
    const enhancer = applyMiddleware(thunkMiddleware);
    realStore = createStore(rootReducer, initState, enhancer);

    history = createMemoryHistory();
    const route = `/entries/${MOCK_ENTRY_10.id}/edit`;
    history.push(route);
  });

  describe("by itself", () => {
    test("initial render (i.e. before/without any user interaction)", () => {
      // Act.
      render(
        <Provider store={realStore}>
          <Router history={history}>
            <Route exact path="/entries/:id/edit">
              <EditEntry />
            </Route>
          </Router>
        </Provider>
      );

      // Assert.
      screen.getByText("2021-09-01 06:01 (UTC +00:00)");

      const elementsWithTheEntryContent = screen.getAllByText(MOCK_ENTRY_10.content);
      expect(elementsWithTheEntryContent.length).toEqual(2);

      screen.getByDisplayValue(MOCK_ENTRY_10_LOCAL_TIME);
      screen.getByDisplayValue(MOCK_ENTRY_10.utcZoneOfTimestamp);
    });

    test("the user fills out the form (without submitting it)", () => {
      // Arrange.
      render(
        <Provider store={realStore}>
          <Router history={history}>
            <Route exact path="/entries/:id/edit">
              <EditEntry />
            </Route>
          </Router>
        </Provider>
      );

      // Act.
      /*
      Unlike the corresponding test case for <CreateEntry>,
      the remainder of this test case
      acts upon and makes assertions about rendered HTML elements
      in the same order as they are rendered on the DOM.
      */
      const [localTimeInput, contentTextArea] = screen.getAllByRole("textbox");
      const timezoneSelect = screen.getByRole("combobox");

      fireEvent.change(localTimeInput, { target: { value: "1999-01-01 03:00" } });
      fireEvent.change(timezoneSelect, { target: { value: "+01:00" } });
      fireEvent.change(contentTextArea, {
        target: {
          value: "This is an Entry resource, all of whose details have been edited.",
        },
      });

      // Assert.
      screen.getByDisplayValue("1999-01-01 03:00");
      screen.getByDisplayValue("+01:00");
      screen.getByDisplayValue(
        "This is an Entry resource, all of whose details have been edited."
      );
    });
  });

  describe(
    "+ <Alerts>" +
      " (without the user interaction triggering any network communication)",
    () => {
      test(
        "the user fills out the form in an invalid way" +
          " (by failing to fill out all required fields) and submits it",
        () => {
          // Arrange.
          render(
            <Provider store={realStore}>
              <Router history={history}>
                <Alerts />
                <Route exact path="/entries/:id/edit">
                  <EditEntry />
                </Route>
              </Router>
            </Provider>
          );

          // Act.
          const timezoneSelect = screen.getByRole("combobox");
          fireEvent.change(timezoneSelect, { target: { value: "" } });

          const button: HTMLElement = screen.getByRole("button", {
            name: "Edit entry",
          });
          fireEvent.click(button);

          // Assert.
          screen.getByText("YOU MUST FILL OUT ALL FORM FIELDS");
        }
      );
    }
  );

  describe("+ <Alerts> (with the user interaction triggering network communication)", () => {
    beforeAll(() => {
      // Enable API mocking.
      quasiServer.listen();
    });

    beforeEach(() => {
      quasiServer.resetHandlers();
    });

    afterAll(() => {
      // Disable API mocking.
      quasiServer.close();
    });

    test(
      "the user fills out the form and submits it," +
        " but the backend is _mocked_ to respond that" +
        " the form was filled out in an invalid way",
      async () => {
        // Arrange.
        quasiServer.use(
          rest.put("/api/entries/:id", (req, res, ctx) => {
            return res.once(
              ctx.status(400),
              ctx.json({
                error: "mocked-Failed to edit the targeted Entry resource",
              })
            );
          })
        );

        render(
          <Provider store={realStore}>
            <Router history={history}>
              <Alerts />
              <Route exact path="/entries/:id/edit">
                <EditEntry />
              </Route>
            </Router>
          </Provider>
        );

        // Act.
        const button: HTMLElement = screen.getByRole("button", { name: "Edit entry" });
        fireEvent.click(button);

        // Assert.
        const element: HTMLElement = await screen.findByText(
          "mocked-Failed to edit the targeted Entry resource"
        );
        expect(element).toBeInTheDocument();
      }
    );

    test(
      "the user fills out the form and submits it," +
        " but the backend is _mocked_ to respond that" +
        " the user's JWS Token is no longer valid",
      async () => {
        // Arrange.
        render(
          <Provider store={realStore}>
            <Router history={history}>
              <Alerts />
              <Route exact path="/sign-in">
                <SignIn />
              </Route>
              <PrivateRoute exact path="/entries/:id/edit">
                <EditEntry />
              </PrivateRoute>
            </Router>
          </Provider>
        );

        // Act.
        const button: HTMLElement = screen.getByRole("button", { name: "Edit entry" });
        fireEvent.click(button);

        // Assert.
        const element: HTMLElement = await screen.findByText(
          "[FROM <EditEntry>'S handleSubmit] PLEASE SIGN BACK IN"
        );
        expect(element).toBeInTheDocument();
      }
    );

    test(
      "the user fills out the form and submits it," +
        " and the backend is _mocked_ to respond that" +
        " the form submission was accepted as valid and processed",
      async () => {
        // Arrange.
        quasiServer.use(rest.put("/api/entries/:id", requestHandlers.mockEditEntry));

        render(
          <Provider store={realStore}>
            <Router history={history}>
              <Alerts />
              <Switch>
                <Route exact path="/entries/:id/edit">
                  <EditEntry />
                </Route>
              </Switch>
            </Router>
          </Provider>
        );

        // Act.
        const button: HTMLElement = screen.getByRole("button", { name: "Edit entry" });
        fireEvent.click(button);

        // Assert.
        const element: HTMLElement = await screen.findByText(
          "ENTRY EDITING SUCCESSFUL"
        );
        expect(element).toBeInTheDocument();

        expect(history.location.pathname).toEqual("/journal-entries");
      }
    );
  });
});

describe("<DeleteEntry>", () => {
  let history;
  let realStore;

  beforeEach(() => {
    const initState: IState = {
      alerts: {
        ...initialStateAlerts,
      },
      auth: {
        requestStatus: RequestStatus.SUCCEEDED,
        requestError: null,
        token: "token-issued-by-the-backend",
        hasValidToken: true,
        signedInUserProfile: null,
      },
      entries: {
        requestStatus: RequestStatus.SUCCEEDED,
        requestError: null,
        _meta: MOCK_META,
        _links: MOCK_LINKS,
        ids: MOCK_ENTRIES_IDS,
        entities: MOCK_ENTRIES_ENTITIES,
      },
    };
    const enhancer = applyMiddleware(thunkMiddleware);
    realStore = createStore(rootReducer, initState, enhancer);

    history = createMemoryHistory();
    const route = `/entries/${MOCK_ENTRY_10.id}/delete`;
    history.push(route);
  });

  describe("without the user interaction triggering any network communication", () => {
    test("initial render (i.e. before/without any user interaction)", () => {
      // Act.
      render(
        <Provider store={realStore}>
          <Router history={history}>
            <PrivateRoute exact path="/entries/:id/delete">
              <DeleteEntry />
            </PrivateRoute>
          </Router>
        </Provider>
      );

      // Assert.
      screen.getByText("You are about to delete the following Entry:");

      screen.getByText("2021-09-01 06:01 (UTC +00:00)");
      screen.getByText(MOCK_ENTRY_10.content);

      screen.getByText("Do you want to delete the selected Entry?");
      screen.getByRole("button", { name: "Yes" });
      screen.getByRole("button", { name: "No" });
    });

    test("the user clicks the 'No' button, which should redirect to /journal-entries", () => {
      // Arrange.
      render(
        <Provider store={realStore}>
          <Router history={history}>
            <PrivateRoute exact path="/journal-entries">
              <JournalEntries />
            </PrivateRoute>
            <PrivateRoute exact path="/entries/:id/delete">
              <DeleteEntry />
            </PrivateRoute>
          </Router>
        </Provider>
      );

      const buttonNo = screen.getByRole("button", { name: "No" });

      // Act.
      fireEvent.click(buttonNo);

      // Assert.
      screen.getByText("Review JournalEntries!");

      expect(history.location.pathname).toEqual("/journal-entries");
    });
  });

  describe("with the user interaction triggering network communication", () => {
    beforeAll(() => {
      // Enable API mocking.
      quasiServer.listen();
    });

    beforeEach(() => {
      quasiServer.resetHandlers();
    });

    afterAll(() => {
      // Disable API mocking.
      quasiServer.close();
    });

    test(
      "the user clicks on the 'Yes' button," +
        " but the backend is _mocked_ to respond that" +
        " the user's JWS Token is no longer valid",
      async () => {
        // Arrange.
        render(
          <Provider store={realStore}>
            <Router history={history}>
              <Alerts />
              <Route exact path="/sign-in">
                <SignIn />
              </Route>
              <PrivateRoute exact path="/entries/:id/delete">
                <DeleteEntry />
              </PrivateRoute>
            </Router>
          </Provider>
        );

        // Act.
        const buttonYes: HTMLElement = screen.getByRole("button", { name: "Yes" });
        fireEvent.click(buttonYes);

        // Assert.
        let element: HTMLElement = await screen.findByText(
          "[FROM <DeleteEntry>'S handleClickYes] PLEASE SIGN BACK IN"
        );
        expect(element).toBeInTheDocument();

        expect(history.location.pathname).toEqual("/sign-in");

        element = screen.getByText("Sign me in");
        expect(element).toBeInTheDocument();
      }
    );

    test(
      "the user clicks on the 'Yes' button," +
        " but the backend is _mocked_ to respond" +
        " with an error, which is not related to authentication",
      async () => {
        // Arrange.
        quasiServer.use(
          rest.delete("/api/entries/:id", (req, res, ctx) => {
            return res.once(
              ctx.status(400),
              ctx.json({
                error:
                  "mocked-Encountered an error," +
                  " which is not related to authentication",
              })
            );
          })
        );

        render(
          <Provider store={realStore}>
            <Router history={history}>
              <Alerts />
              <PrivateRoute exact path="/entries/:id/delete">
                <DeleteEntry />
              </PrivateRoute>
            </Router>
          </Provider>
        );

        // Act.
        const buttonYes: HTMLElement = screen.getByRole("button", { name: "Yes" });
        fireEvent.click(buttonYes);

        // Assert.
        const element: HTMLElement = await screen.findByText(
          "mocked-Encountered an error, which is not related to authentication"
        );
        expect(element).toBeInTheDocument();
      }
    );

    test(
      "the user clicks on the 'Yes' button," +
        " and the backend is _mocked_ to respond that" +
        " the DELETE request was accepted as valid and processed",
      async () => {
        // Arrange.
        quasiServer.use(
          rest.delete("/api/entries/:id", requestHandlers.mockDeleteEntry)
        );

        render(
          <Provider store={realStore}>
            <Router history={history}>
              <Alerts />
              <Switch>
                <Route exact path="/entries/:id/delete">
                  <DeleteEntry />
                </Route>
              </Switch>
            </Router>
          </Provider>
        );

        const buttonYes: HTMLElement = screen.getByRole("button", { name: "Yes" });

        // Act.
        fireEvent.click(buttonYes);

        // Assert.
        const element: HTMLElement = await screen.findByText(
          "ENTRY DELETION SUCCESSFUL"
        );
        expect(element).toBeInTheDocument();

        expect(history.location.pathname).toEqual("/journal-entries");
      }
    );
  });
});
