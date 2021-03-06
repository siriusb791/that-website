import React from 'react';
import Head from 'next/head';
import { getDataFromTree } from '@apollo/react-ssr';
import debug from 'debug';

import initApollo from './initApollo';
import auth0 from './auth0';

const dlog = debug('that:apollo:with');

export default App => {
  return class Apollo extends React.Component {
    // eslint-disable-next-line react/static-property-placement
    static displayName = 'withApollo(App)';

    static async getInitialProps(ctx) {
      dlog('getInitalProps');

      const { AppTree } = ctx;
      let appProps = {};
      let bearerToken;

      if (typeof window === 'undefined') {
        dlog('in ssr mode, getting users session');
        const userSession = await auth0.getSession(ctx.ctx.req);

        if (userSession && userSession.user) {
          dlog('user session %O', userSession);

          // Using tokenCache handles token expiration checks and refresh
          const tokenCache = await auth0.tokenCache(ctx.ctx.req, ctx.ctx.res);
          const { accessToken } = await tokenCache.getAccessToken();
          dlog('acccessToken %s', accessToken);

          bearerToken = accessToken;
        }
      }

      if (App.getInitialProps) {
        appProps = await App.getInitialProps(ctx);
      }

      // Run all GraphQL queries in the component tree
      // and extract the resulting data
      const apollo = initApollo(undefined, bearerToken);
      if (typeof window === 'undefined') {
        try {
          // Run all GraphQL queries
          await getDataFromTree(
            <AppTree {...appProps} apolloClient={apollo} />,
          );
        } catch (error) {
          // Prevent Apollo Client GraphQL errors from crashing SSR.
          // Handle them in components via the data.error prop:
          // https://www.apollographql.com/docs/react/api/react-apollo.html#graphql-query-data-error
          // eslint-disable-next-line no-console
          console.error('Error while running `getDataFromTree`', error);
        }

        // getDataFromTree does not call componentWillUnmount
        // head side effect therefore need to be cleared manually
        Head.rewind();
      }

      // Extract query data from the Apollo store
      const apolloState = apollo.cache.extract();

      return {
        ...appProps,
        apolloState,
        bearerToken,
      };
    }

    constructor(props) {
      super(props);
      this.apolloClient = initApollo(props.apolloState, props.bearerToken);
    }

    render() {
      return <App apolloClient={this.apolloClient} {...this.props} />;
    }
  };
};
