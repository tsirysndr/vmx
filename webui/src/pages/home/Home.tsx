import List from "./List";

function Home() {
  return (
    <div className="p-6 mt-5 w-full">
      <h1 className="text-[17x] ">Virtual Machines</h1>
      <div className="mt-6 flex justify-between w-full">
        <div>
          <div className="input input-sm flex max-w-sm space-x-4 bg-(--color-background) border-r text-[13px]">
            <span className="icon-[tabler--search] my-auto size-4 shrink-0 text-[#63656d]!"></span>
            <input
              type="search"
              className="grow"
              placeholder="Filter VMs..."
              id="kbdInput"
            />
          </div>
        </div>
        <button className="btn btn-primary btn-sm  text-white! text-[13px]">
          Create Virtual Machine
        </button>
      </div>
      <div className="w-full overflow-x-auto mt-10">
        <List />
      </div>
    </div>
  );
}

export default Home;
