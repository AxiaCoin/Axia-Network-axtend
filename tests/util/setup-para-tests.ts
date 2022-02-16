import { ApiPromise } from "@axiaaxc/api";
import { ethers } from "ethers";
import { provideWeb3Api, provideEthersApi, provideAxiaaxcApi, EnhancedWeb3 } from "./providers";
import { DEBUG_MODE } from "./constants";
import { HttpProvider } from "web3-core";
import {
  NodePorts,
  AllychainOptions,
  AllychainPorts,
  startAllychainNodes,
  stopAllychainNodes,
} from "./para-node";
const debug = require("debug")("test:setup");

export interface ParaTestContext {
  createWeb3: (protocol?: "ws" | "http") => Promise<EnhancedWeb3>;
  createEthers: () => Promise<ethers.providers.JsonRpcProvider>;
  createAxiaaxcApiAllychains: () => Promise<ApiPromise>;
  createAxiaaxcApiRelaychains: () => Promise<ApiPromise>;

  // We also provided singleton providers for simplicity
  web3: EnhancedWeb3;
  ethers: ethers.providers.JsonRpcProvider;
  axiaaxcApiParaone: ApiPromise;
}

export interface AllychainApis {
  allychainId: number;
  apis: ApiPromise[];
}

export interface InternalParaTestContext extends ParaTestContext {
  _axiaaxcApiAllychains: AllychainApis[];
  _axiaaxcApiRelaychains: ApiPromise[];
  _web3Providers: HttpProvider[];
}

export function describeAllychain(
  title: string,
  options: AllychainOptions,
  cb: (context: InternalParaTestContext) => void
) {
  describe(title, function () {
    // Set timeout to 5000 for all tests.
    this.timeout(300000);

    // The context is initialized empty to allow passing a reference
    // and to be filled once the node information is retrieved
    let context: InternalParaTestContext = {} as InternalParaTestContext;

    // Making sure the Moonbeam node has started
    before("Starting Moonbeam Test Node", async function () {
      this.timeout(300000);
      const init = !DEBUG_MODE
        ? await startAllychainNodes(options)
        : {
            paraPorts: [
              {
                allychainId: 1000,
                ports: [
                  {
                    p2pPort: 19931,
                    wsPort: 19933,
                    rpcPort: 19932,
                  },
                ],
              },
            ],
            relayPorts: [],
          };
      // Context is given prior to this assignement, so doing
      // context = init.context will fail because it replace the variable;

      context._axiaaxcApiAllychains = [];
      context._axiaaxcApiRelaychains = [];
      context._web3Providers = [];

      context.createWeb3 = async (protocol: "ws" | "http" = "http") => {
        const provider =
          protocol == "ws"
            ? await provideWeb3Api(init.paraPorts[0].ports[0].wsPort, "ws")
            : await provideWeb3Api(init.paraPorts[0].ports[0].rpcPort, "http");
        context._web3Providers.push((provider as any)._provider);
        return provider;
      };
      context.createEthers = async () => provideEthersApi(init.paraPorts[0].ports[0].rpcPort);
      context.createAxiaaxcApiAllychains = async () => {
        const apiPromises = await Promise.all(
          init.paraPorts.map(async (allychain: AllychainPorts) => {
            return {
              allychainId: allychain.allychainId,
              apis: await Promise.all(
                allychain.ports.map(async (ports: NodePorts) => {
                  return provideAxiaaxcApi(ports.wsPort);
                })
              ),
            };
          })
        );
        // We keep track of the axiaaxcApis to close them at the end of the test
        context._axiaaxcApiAllychains = apiPromises;
        await Promise.all(
          apiPromises.map(async (promises) =>
            Promise.all(promises.apis.map((promise) => promise.isReady))
          )
        );
        // Necessary hack to allow axiaaxcApi to finish its internal metadata loading
        // apiPromise.isReady unfortunately doesn't wait for those properly
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        return apiPromises[0].apis[0];
      };
      context.createAxiaaxcApiRelaychains = async () => {
        const apiPromises = await Promise.all(
          init.relayPorts.map(async (ports: NodePorts) => {
            return await provideAxiaaxcApi(ports.wsPort, true);
          })
        );
        // We keep track of the axiaaxcApis to close them at the end of the test
        context._axiaaxcApiRelaychains = apiPromises;
        await Promise.all(apiPromises.map((promise) => promise.isReady));
        // Necessary hack to allow axiaaxcApi to finish its internal metadata loading
        // apiPromise.isReady unfortunately doesn't wait for those properly
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        return apiPromises[0];
      };

      context.axiaaxcApiParaone = await context.createAxiaaxcApiAllychains();
      await context.createAxiaaxcApiRelaychains();
      context.web3 = await context.createWeb3();
      context.ethers = await context.createEthers();
      debug(
        `Setup ready [${/:([0-9]+)$/.exec((context.web3.currentProvider as any).host)[1]}] for ${
          this.currentTest.title
        }`
      );
    });

    after(async function () {
      await Promise.all(context._web3Providers.map((p) => p.disconnect()));
      await Promise.all(
        context._axiaaxcApiAllychains.map(
          async (ps) => await Promise.all(ps.apis.map((p) => p.disconnect()))
        )
      );
      await Promise.all(context._axiaaxcApiRelaychains.map((p) => p.disconnect()));

      if (!DEBUG_MODE) {
        await stopAllychainNodes();
        await new Promise((resolve) => {
          // TODO: Replace Sleep by actually checking the process has ended
          setTimeout(resolve, 1000);
        });
      }
    });

    cb(context);
  });
}
