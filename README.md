# AElf Toolkit

## What is it?

**AElf Toolkit** is a tool that simplifies how you interact with the AElf Blockchain from right within Visual Studio Code! It provides the following features:

1. Create, Write & Build Smart Contracts
2. Create & Manage AElf Wallets 
3. Transfer assets (e.g ELF) between wallets
4. Launch local AElf node instances 
5. Deploy contracts to local node/testnet


....all with the click of a button!

Our goal is to provide developers with a set of familiar tools that would empower them to focus on building dApps -- not tooling -- on AElf. 


## Future Plans/Roadmap

What you see before you is the result of a one-man effort over the past one week. I have big plans for this tool, and with the help of community-led grants, hope to execute on them. One of the big plans I'm working on (in a separate dev branch) is a **Visual Development Blockchain Tracker** for ***Aelf Toolkit*** that would bring the power of a blockchain explorer right within the comforts of VSCode.

I also hope to launch a web version of this so developers unfamilar/not comfortable with VSCode can still benefit from this toolkit that, I believe, will radically increase the number of dApps built on the AElf Blockchain ecosystem.


## Setup & Installation

With many breaking changes to the main AElf repo, you might encounter various problems when using ***AElf Toolkit***. As such, it is **imperative** you follow the instructions below that have been personally verified by myself. Thanks!


### 1. Pre-requisites
You might need to have the following already configured on your system:
1. Redis (accessible via `redis-cli`)


### 2. Clone the AElfProject repo
```bash
$ git clone https://github.com/AElfProject/AElf.git AElfProject
$ git checkout 777a1c059aa6bae33874430a75a41ea4340edfb8 # important
$ cd AElfProject
$ dotnet publish AElf.All.sln /p:NoBuild=false --configuration Debug -o ~/AElf # you might need to install any necessary requirements for AElfProject
```

Note the directory in which these final executables are stored (in this case `~/AElf`)

### 3. Clone the AElf-cli repo

```bash
$ git clone https://github.com/AElfProject/aelf-cli.git AElfCli
$ cd AElfCli/src/AElf.Cli
$ dotnet pack
$ dotnet tool install --global --add-source ./nupkg aelf.cli
```

Ensure this is accessible via `aelf start`. 


### 4. Almost there!

1. Extract the [`AElfConfiguration.zip`](https://github.com/jasmcaus/aelf-toolkit/blob/dev/AElfConfguration.zip) file in the root of this repo into a directory of your choosing. Note this folder as well.
2. Create a file somewhere in a directory of your choosing as follows. This will be the executable script that will help AElf Toolkit spin up a local server on your machine.

```bash
$ vi aelf-run-single # this naming is absolutely essential. Mispelling will lead to errors
```

Copy the following contents into the file:

```json
cd <dir-to-extracted-zip/singlenode> && dotnet ~/AElf/AElf.Launcher.dll
```

If you're on a Linux or MacOS machine, ensure you give this file executable permissions:
```bash
$ chmod +x aelf-run-single
```

Assuming you've followed these steps **to-the-T**, you are now ready to use ***AElf Toolkit***.
